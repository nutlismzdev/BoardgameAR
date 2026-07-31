<?php
// ── ห้องแข่งออนไลน์ (แข่งขนาน) ──
// แต่ละทีมเล่นกระดานของตัวเอง แล้วรายงานเหรียญขึ้นมาที่นี่ → ทุกเครื่องเห็นอันดับสดของกันและกัน
// กติกาเกมยังอยู่ที่ store.ts ในเครื่องเหมือนเดิม ที่นี่เป็นแค่ "กระดานคะแนนกลาง" (ดู ROOM-PLAN.md)
//
// ⚠️ เวลาทั้งหมดเป็น unix timestamp (INT) ที่คิดด้วย time() ของ PHP ฝั่งเดียว
//    ห้ามผสมกับ NOW() ของ MySQL เพราะ timezone ของสองตัวอาจไม่ตรงกัน แล้วเวลาแข่งจะเพี้ยน
//    (created_at เป็น TIMESTAMP ได้ เพราะใช้เก็บกวาดของเก่าเท่านั้น คลาดเคลื่อนไม่กระทบเกม)
require_once __DIR__ . '/lib.php';

const ROOM_TTL_HOURS = 6;       // ห้องเก่ากว่านี้ถูกลบทิ้ง
const ROOM_MAX_TEAMS = 12;      // กันเซิร์ฟเวอร์ (php -S รับทีละคำขอ) และกันจออันดับล้น
const ROOM_ONLINE_SEC = 60;     // ไม่ส่ง sync เกินเท่านี้ = ถือว่าหลุด
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ตัด I O 0 1 ออก กันอ่านผิด

handle_cors();
ensure_room_tables();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'POST') {
    // GET ?code=XXXX — อ่านสถานะห้อง (ใช้กับล็อบบี้/จอฉาย ไม่ต้องมี token)
    $code = normalize_room_code((string) ($_GET['code'] ?? ''));
    send_json(['ok' => true] + room_state($code));
}

$body = read_json_body();
$action = require_string($body, 'action');

switch ($action) {
    case 'create':
        require_admin(); // สร้างห้องต้องเป็นครู — เข้าร่วมไม่ต้อง (เหมือน PIN ของ Kahoot)
        // เก็บกวาดตอนสร้างห้องเท่านั้น — ห้ามใส่ไว้หัวไฟล์ ไม่งั้น sync ทุก 3 วิ/ทีม
        // จะลาก DELETE + subquery ไปด้วยทุกครั้งบนเซิร์ฟเวอร์ที่รับทีละคำขอ
        purge_old_rooms();
        $hostName = clean_team_name(require_string($body, 'hostName'));
        $rules = validate_rules($body['rules'] ?? []);
        $code = create_room($hostName, $rules);
        send_json(['ok' => true, 'code' => $code, 'rules' => $rules]);

    case 'join':
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $teamName = clean_team_name(require_string($body, 'teamName'));
        $room = load_room($code);
        if ($room['status'] !== 'lobby') {
            send_json(['ok' => false, 'error' => 'room already started'], 409);
        }
        $rules = json_decode((string) $room['rules'], true) ?: [];
        // คลังคำถามต้องตรงกันทุกทีม ไม่งั้นแข่งกันไม่มีความหมาย (ดู ROOM-PLAN ข้อ 7)
        $clientVersion = (int) ($body['contentVersion'] ?? 0);
        if ($clientVersion !== (int) ($rules['contentVersion'] ?? 0)) {
            send_json([
                'ok' => false,
                'error' => 'content version mismatch',
                'need' => (int) ($rules['contentVersion'] ?? 0),
                'have' => $clientVersion,
            ], 409);
        }
        $count = (int) query_one('SELECT COUNT(*) FROM room_team WHERE room_code = ?', [$code]);
        if ($count >= ROOM_MAX_TEAMS) {
            send_json(['ok' => false, 'error' => 'room is full'], 409);
        }
        $token = bin2hex(random_bytes(16));
        $stmt = get_db()->prepare(
            'INSERT INTO room_team (room_code, team_token, team_name, last_seen) VALUES (?, ?, ?, ?)'
        );
        try {
            $stmt->execute([$code, $token, $teamName, time()]);
        } catch (PDOException $e) {
            // UNIQUE(room_code, team_name) — ชื่อทีมซ้ำในห้องเดียวกัน
            send_json(['ok' => false, 'error' => 'team name already used in this room'], 409);
        }
        send_json(['ok' => true, 'teamToken' => $token] + room_state($code));

    case 'start':
        require_admin();
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $room = load_room($code);
        if ($room['status'] !== 'lobby') {
            send_json(['ok' => false, 'error' => 'room already started'], 409);
        }
        $rules = json_decode((string) $room['rules'], true) ?: [];
        $now = time();
        $stmt = get_db()->prepare(
            "UPDATE room SET status = 'running', started_at = ?, ends_at = ? WHERE code = ?"
        );
        $stmt->execute([$now, $now + (int) $rules['durationSec'], $code]);
        send_json(['ok' => true] + room_state($code));

    case 'sync':
        // หัวใจของระบบ: รายงานแต้มของตัวเอง **แล้วรับสถานะห้องทั้งหมดกลับในคำตอบเดียว**
        // (เซิร์ฟเวอร์รับทีละคำขอ การประหยัด round trip คือการประหยัดคอขวดโดยตรง)
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $token = (string) ($body['teamToken'] ?? '');
        $room = load_room($code); // เช็กห้องก่อน จะได้ขึ้น "ไม่พบห้อง" แทน "ไม่พบทีม" เมื่อรหัสผิด
        $team = find_team($code, $token);
        $rules = json_decode((string) $room['rules'], true) ?: [];
        $now = time();

        // ห้องจบแล้วต้องหยุดนับแต้ม — ไม่งั้นทีมที่เล่นต่อหลังหมดเวลายังไต่อันดับได้เรื่อย ๆ
        // (ยังอัปเดต last_seen เพื่อให้จอสรุปรู้ว่าใครยังออนไลน์อยู่)
        if ($room['status'] === 'ended') {
            $stmt = get_db()->prepare(
                'UPDATE room_team SET last_seen = ? WHERE room_code = ? AND team_token = ?'
            );
            $stmt->execute([$now, $code, $token]);
            send_json(['ok' => true] + room_state($code));
        }

        $kingCoins = clamp_int($body['kingCoins'] ?? 0, 0, (int) $rules['targetCoins']);
        $coins = clamp_int($body['coins'] ?? 0, 0, 999999);
        // แต้มเพิ่มได้อย่างเดียว — กันเครื่องที่เพิ่งกลับมาจากออฟไลน์รายงานค่าเก่าทับของใหม่
        $kingCoins = max($kingCoins, (int) $team['king_coins']);
        $coins = max($coins, (int) $team['coins']);

        $elapsed = max(1, $now - (int) $team['last_seen']);
        $jump = $kingCoins - (int) $team['king_coins'];
        // เหรียญกษัตริย์ต้อง "ลงช่องทองพอดี" เท่านั้น จะได้เร็วกว่านี้ไม่ได้ในทางปฏิบัติ
        // → ติดธงให้ครูเห็น ไม่ปฏิเสธ (ปฏิเสธพลาดแล้วเกมพังกลางคาบ เสียหายกว่า)
        $alreadySuspect = (int) $team['suspect'] === 1;
        $suspect = ($alreadySuspect || ($jump > 2 && $elapsed < 60)) ? 1 : 0;

        $finishedAt = $team['finished_at'];
        if ($finishedAt === null && $kingCoins >= (int) $rules['targetCoins']) {
            $finishedAt = $now;
        }
        $stmt = get_db()->prepare(
            'UPDATE room_team SET king_coins = ?, coins = ?, finished_at = ?, suspect = ?, last_seen = ?
             WHERE room_code = ? AND team_token = ?'
        );
        $stmt->execute([$kingCoins, $coins, $finishedAt, $suspect, $now, $code, $token]);

        // มีทีมถึงเป้า = จบทั้งห้องทันที (ไม่ต้องรอหมดเวลา)
        if ($finishedAt !== null && $room['status'] === 'running') {
            get_db()->prepare("UPDATE room SET status = 'ended' WHERE code = ?")->execute([$code]);
        }
        send_json(['ok' => true] + room_state($code));

    case 'leave':
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $token = (string) ($body['teamToken'] ?? '');
        $stmt = get_db()->prepare('DELETE FROM room_team WHERE room_code = ? AND team_token = ?');
        $stmt->execute([$code, $token]);
        send_json(['ok' => true]);

    case 'end':
        require_admin();
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        load_room($code);
        get_db()->prepare("UPDATE room SET status = 'ended' WHERE code = ?")->execute([$code]);
        send_json(['ok' => true] + room_state($code));

    default:
        send_json(['ok' => false, 'error' => 'unknown action'], 400);
}

// ─────────────────────────── helpers ───────────────────────────

function room_state(string $code): array
{
    $room = load_room($code);
    $rules = json_decode((string) $room['rules'], true) ?: [];
    $now = time();
    $endsAt = $room['ends_at'] === null ? null : (int) $room['ends_at'];
    $status = $room['status'];

    // หมดเวลาแล้วปิดห้องให้เอง — ทำตอนอ่านสถานะ ไม่ต้องมี cron
    if ($status === 'running' && $endsAt !== null && $now >= $endsAt) {
        get_db()->prepare("UPDATE room SET status = 'ended' WHERE code = ?")->execute([$code]);
        $status = 'ended';
    }

    $stmt = get_db()->prepare(
        'SELECT team_name, king_coins, coins, finished_at, suspect, last_seen
         FROM room_team WHERE room_code = ?'
    );
    $stmt->execute([$code]);
    $teams = array_map(static function (array $row) use ($now): array {
        return [
            'name' => $row['team_name'],
            'kingCoins' => (int) $row['king_coins'],
            'coins' => (int) $row['coins'],
            'finishedAt' => $row['finished_at'] === null ? null : (int) $row['finished_at'],
            'suspect' => (bool) $row['suspect'],
            'online' => ($now - (int) $row['last_seen']) <= ROOM_ONLINE_SEC,
        ];
    }, $stmt->fetchAll());

    // อันดับ: เหรียญกษัตริย์ → เหรียญปกติ → ใครถึงก่อน
    usort($teams, static function (array $a, array $b): int {
        if ($a['kingCoins'] !== $b['kingCoins']) {
            return $b['kingCoins'] <=> $a['kingCoins'];
        }
        if ($a['coins'] !== $b['coins']) {
            return $b['coins'] <=> $a['coins'];
        }
        $af = $a['finishedAt'] ?? PHP_INT_MAX;
        $bf = $b['finishedAt'] ?? PHP_INT_MAX;
        return $af <=> $bf;
    });

    return [
        'room' => [
            'code' => $room['code'],
            'hostName' => $room['host_name'],
            'status' => $status,
            'rules' => $rules,
            'startedAt' => $room['started_at'] === null ? null : (int) $room['started_at'],
            'endsAt' => $endsAt,
            // ส่งเวลาเซิร์ฟเวอร์ไปด้วยเสมอ ให้ทุกเครื่องนับถอยหลังจากฐานเดียวกัน
            // (นาฬิกาแท็บเล็ตแต่ละทีมไม่ตรงกัน — ห้ามให้ client ใช้ Date.now() คิดเวลาที่เหลือ)
            'serverTime' => $now,
        ],
        'teams' => $teams,
    ];
}

function create_room(string $hostName, array $rules): string
{
    $payload = json_encode($rules, JSON_UNESCAPED_UNICODE);
    for ($attempt = 0; $attempt < 12; $attempt++) {
        $code = random_room_code();
        $stmt = get_db()->prepare(
            "INSERT INTO room (code, host_name, status, rules) VALUES (?, ?, 'lobby', ?)"
        );
        try {
            $stmt->execute([$code, $hostName, $payload]);
            return $code;
        } catch (PDOException $e) {
            // รหัสชนกัน — สุ่มใหม่
        }
    }
    send_json(['ok' => false, 'error' => 'could not allocate room code'], 500);
}

function random_room_code(): string
{
    $code = '';
    $len = strlen(ROOM_CODE_ALPHABET);
    for ($i = 0; $i < 6; $i++) {
        $code .= ROOM_CODE_ALPHABET[random_int(0, $len - 1)];
    }
    return $code;
}

function normalize_room_code(string $raw): string
{
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $raw) ?? '');
    if (!preg_match('/^[A-Z0-9]{4,8}$/', $code)) {
        send_json(['ok' => false, 'error' => 'invalid room code'], 400);
    }
    return $code;
}

function load_room(string $code): array
{
    $stmt = get_db()->prepare('SELECT * FROM room WHERE code = ?');
    $stmt->execute([$code]);
    $room = $stmt->fetch();
    if ($room === false) {
        send_json(['ok' => false, 'error' => 'room not found'], 404);
    }
    return $room;
}

function find_team(string $code, string $token): array
{
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
        send_json(['ok' => false, 'error' => 'invalid team token'], 400);
    }
    $stmt = get_db()->prepare('SELECT * FROM room_team WHERE room_code = ? AND team_token = ?');
    $stmt->execute([$code, $token]);
    $team = $stmt->fetch();
    if ($team === false) {
        send_json(['ok' => false, 'error' => 'team not found'], 404);
    }
    return $team;
}

// ชื่อทีม = ชื่อทีมเรียน — ห้ามชื่อจริงเด็ก (PDPA) ฝั่งเว็บเตือนไว้แล้ว
// ที่นี่ทำได้แค่จำกัดความยาวและตัดอักขระควบคุมทิ้ง
function clean_team_name(string $raw): string
{
    $name = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $raw) ?? '');
    if ($name === '' || mb_strlen($name) > 40) {
        send_json(['ok' => false, 'error' => 'team name must be 1-40 characters'], 400);
    }
    return $name;
}

function validate_rules(mixed $raw): array
{
    if (!is_array($raw)) {
        send_json(['ok' => false, 'error' => 'invalid rules'], 400);
    }
    $difficulty = (string) ($raw['difficulty'] ?? 'all');
    if (!in_array($difficulty, ['all', 'easy', 'medium', 'hard'], true)) {
        send_json(['ok' => false, 'error' => 'invalid difficulty'], 400);
    }
    return [
        // 5 นาที – 2 ชม. · ค่าที่ใช้จริงในคาบเรียนคือ 20-30 นาที
        'durationSec' => clamp_int($raw['durationSec'] ?? 1800, 300, 7200),
        'targetCoins' => clamp_int($raw['targetCoins'] ?? 7, 1, 7),
        // ล็อกจำนวนผู้เล่นต่อเครื่องให้เท่ากันทุกทีม ไม่งั้นทีม 4 คนได้ทอยเต๋าบ่อยกว่าทีม 2 คนเท่าตัว
        'playersPerTeam' => clamp_int($raw['playersPerTeam'] ?? 2, 1, 4),
        'difficulty' => $difficulty,
        // ล็อกเวอร์ชันคลังคำถามไว้ตั้งแต่สร้างห้อง — ผู้เข้าร่วมต้องมีเวอร์ชันเดียวกันเท่านั้น
        'contentVersion' => content_version(),
    ];
}

function clamp_int(mixed $value, int $min, int $max): int
{
    $n = is_numeric($value) ? (int) $value : $min;
    return max($min, min($max, $n));
}

function query_one(string $sql, array $params): mixed
{
    $stmt = get_db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchColumn();
}

function purge_old_rooms(): void
{
    $db = get_db();
    $db->exec('DELETE FROM room_team WHERE room_code IN
        (SELECT code FROM room WHERE created_at < (NOW() - INTERVAL ' . ROOM_TTL_HOURS . ' HOUR))');
    $db->exec('DELETE FROM room WHERE created_at < (NOW() - INTERVAL ' . ROOM_TTL_HOURS . ' HOUR)');
}

// สร้างตารางอัตโนมัติสำหรับ DB เดิม (แบบเดียวกับ ensure_challenge_table ใน challenge.php)
function ensure_room_tables(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $db = get_db();
    $db->exec(
        "CREATE TABLE IF NOT EXISTS room (
            code VARCHAR(8) PRIMARY KEY,
            host_name VARCHAR(80) NOT NULL,
            status ENUM('lobby','running','ended') NOT NULL DEFAULT 'lobby',
            rules TEXT NOT NULL,
            started_at INT NULL,
            ends_at INT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_room_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $db->exec(
        "CREATE TABLE IF NOT EXISTS room_team (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(8) NOT NULL,
            team_token VARCHAR(40) NOT NULL,
            team_name VARCHAR(60) NOT NULL,
            king_coins TINYINT NOT NULL DEFAULT 0,
            coins INT NOT NULL DEFAULT 0,
            finished_at INT NULL,
            suspect TINYINT(1) NOT NULL DEFAULT 0,
            last_seen INT NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_room_team (room_code, team_name),
            INDEX idx_room (room_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}
