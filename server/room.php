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

// ── การ์ดป่วนข้ามทีม ──
const EFFECT_KINDS = ['ghost', 'storm', 'steal', 'hardQuiz', 'lockItems', 'block', 'rewind'];
const EFFECT_COOLDOWN_SEC = 120; // 1 ใบ ต่อ 2 นาที ต่อทีม — กันสแปมและกันคำขอถล่มเซิร์ฟเวอร์
const ROOM_MAX_NEW_PER_HOUR = 60; // เพดานสร้างห้องต่อชั่วโมง (กันสแปมเมื่อไม่มี login)
const EFFECT_INBOX_MAX = 2;      // ค้างในตัวได้ทีละ 2 ใบ ที่เกินถูกปฏิเสธ (กันทีมเดียวโดนถล่มพร้อมกัน)

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
        // ── ไม่ต้อง login ── ใครสร้างห้องก็ได้ แต่ "คนที่สร้าง" เท่านั้นที่คุมห้องได้ (host_token)
        // เดิมบังคับรหัสครู ซึ่งเป็นรหัสเดียวกับที่เข้า CMS ได้ทั้งหมด → ครูต้องพิมพ์รหัสนั้นต่อหน้าเด็ก
        // แล้ว token ค้างในเครื่อง = เครื่องนั้นเข้าหลังบ้านได้ตลอด · การบังคับ login จึงเพิ่มความเสี่ยง
        // แทนที่จะลด ส่วนสิ่งที่อยากกันจริง ๆ (ใครกดเริ่ม/จบห้อง) แก้ด้วย host_token ตรงกว่า
        // เก็บกวาดตอนสร้างห้องเท่านั้น — ห้ามใส่ไว้หัวไฟล์ ไม่งั้น sync ทุก 3 วิ/ทีม
        // จะลาก DELETE + subquery ไปด้วยทุกครั้งบนเซิร์ฟเวอร์ที่รับทีละคำขอ
        purge_old_rooms();
        // กันสร้างห้องถล่ม (เปิดสาธารณะแล้วไม่มี login) — ห้องหมดอายุเองใน 6 ชม. อยู่แล้ว
        $recent = (int) query_one('SELECT COUNT(*) FROM room WHERE created_at > (NOW() - INTERVAL 1 HOUR)', []);
        if ($recent >= ROOM_MAX_NEW_PER_HOUR) {
            send_json(['ok' => false, 'error' => 'too many rooms'], 429);
        }
        $hostName = clean_team_name(require_string($body, 'hostName'));
        $rules = validate_rules($body['rules'] ?? []);
        $hostToken = bin2hex(random_bytes(16));
        $code = create_room($hostName, $rules, $hostToken);
        // สร้างทีมของเจ้าของห้องให้เลยในคำขอเดียว — ไม่ต้องให้ client วน join ตามอีกรอบ
        get_db()->prepare(
            'INSERT INTO room_team (room_code, team_token, team_name, last_seen) VALUES (?, ?, ?, ?)'
        )->execute([$code, $hostToken, $hostName, time()]);
        send_json(['ok' => true, 'code' => $code, 'teamToken' => $hostToken] + room_state($code));

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
            'INSERT INTO room_team (room_code, team_token, team_name, lineup, last_seen) VALUES (?, ?, ?, ?, ?)'
        );
        try {
            $stmt->execute([$code, $token, $teamName, clean_lineup($body['lineup'] ?? null, (int) $rules['playersPerTeam']), time()]);
        } catch (PDOException $e) {
            // UNIQUE(room_code, team_name) — ชื่อทีมซ้ำในห้องเดียวกัน
            send_json(['ok' => false, 'error' => 'team name already used in this room'], 409);
        }
        send_json(['ok' => true, 'teamToken' => $token] + room_state($code));

    case 'start':
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $room = require_host($code, (string) ($body['teamToken'] ?? ''));
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

        // ── การ์ดป่วน: ฝากไปกับ sync ที่วิ่งอยู่แล้ว ไม่มี endpoint แยก ──
        // ส่งไม่สำเร็จ **ห้ามทำให้ sync ทั้งก้อนพัง** (มันคือชีพจรของเกม) → คืนเหตุผลมาเป็นฟิลด์แทน
        $sendResult = null;
        if (isset($body['send']) && is_array($body['send'])) {
            $sendResult = try_send_effect($code, $rules, (string) $team['team_name'], $body['send'], $now);
        }
        $inbox = take_inbox($code, (string) $team['team_name']);
        // เหลืออีกกี่วินาทีถึงจะส่งใบถัดไปได้ — ให้ปุ่มฝั่งเกมนับถอยหลังได้โดยไม่ต้องเดา
        $lastSent = (int) query_one(
            'SELECT COALESCE(MAX(created_at), 0) FROM room_effect WHERE room_code = ? AND from_team = ?',
            [$code, (string) $team['team_name']]
        );
        $wait = max(0, EFFECT_COOLDOWN_SEC - ($now - $lastSent));

        send_json(
            ['ok' => true, 'incoming' => $inbox, 'sent' => $sendResult, 'sabotageWait' => $wait]
            + room_state($code)
        );

    case 'lineup':
        // เลือกขุนศึกในล็อบบี้ — ทุกทีมเห็นของกันและกัน (นั่นคือสิ่งที่ทำให้รู้สึกว่ากำลังท้าชิง)
        // heartbeat ยังไม่ทำงานตอน phase 'setup' จึงต้องมี action แยก ไม่ฝากไปกับ sync ได้
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $token = (string) ($body['teamToken'] ?? '');
        $room = load_room($code);
        find_team($code, $token);
        $rules = json_decode((string) $room['rules'], true) ?: [];
        // ตัดตามจำนวนผู้เล่นต่อเครื่องที่ห้องล็อกไว้ — ไม่งั้น client แก้ค่าแล้วโชว์ขุนศึกเกินโควตาได้
        $stmt = get_db()->prepare('UPDATE room_team SET lineup = ? WHERE room_code = ? AND team_token = ?');
        $stmt->execute([clean_lineup($body['lineup'] ?? null, (int) ($rules['playersPerTeam'] ?? 4)), $code, $token]);
        send_json(['ok' => true] + room_state($code));

    case 'leave':
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        $token = (string) ($body['teamToken'] ?? '');
        $stmt = get_db()->prepare('DELETE FROM room_team WHERE room_code = ? AND team_token = ?');
        $stmt->execute([$code, $token]);
        send_json(['ok' => true]);

    case 'end':
        $code = normalize_room_code((string) ($body['code'] ?? ''));
        require_host($code, (string) ($body['teamToken'] ?? ''));
        get_db()->prepare("UPDATE room SET status = 'ended' WHERE code = ?")->execute([$code]);
        send_json(['ok' => true] + room_state($code));

    default:
        send_json(['ok' => false, 'error' => 'unknown action'], 400);
}

// ─────────────────────────── การ์ดป่วน ───────────────────────────

/**
 * ตรวจกฎแล้วบันทึกการ์ดป่วน 1 ใบ — คืน ['ok'=>true] หรือ ['ok'=>false,'error'=>...]
 * ⚠️ กฎทั้งหมดตรวจที่นี่ ห้ามเชื่อ client (เขาแก้ค่าที่ส่งมาได้หมด)
 */
function try_send_effect(string $code, array $rules, string $fromTeam, array $send, int $now): array
{
    if (empty($rules['sabotage'])) {
        return ['ok' => false, 'error' => 'sabotage disabled'];
    }
    $kind = (string) ($send['kind'] ?? '');
    $to = trim((string) ($send['to'] ?? ''));
    if (!in_array($kind, EFFECT_KINDS, true) || $to === '' || $to === $fromTeam) {
        return ['ok' => false, 'error' => 'invalid effect'];
    }

    // ── กฎหลัก: ยิงได้เฉพาะทีมที่ "อันดับสูงกว่าเรา" ──
    // ถ้าปล่อยให้ยิงใครก็ได้ ทีมนำจะรุมทีมท้ายจนไม่มีวันตามทัน แล้วเด็กกลุ่มนั้นถอดใจกลางคาบ
    // กฎนี้ทำให้การป่วนกลายเป็นกลไกไล่กวด และคนที่โดนบ่อยที่สุดคือ "ทีมที่นำ" ซึ่งตรงตามเจตนา
    $ranked = ranked_team_names($code);
    $myRank = array_search($fromTeam, $ranked, true);
    $targetRank = array_search($to, $ranked, true);
    if ($targetRank === false) {
        return ['ok' => false, 'error' => 'target not in room'];
    }
    if ($myRank === false || $targetRank >= $myRank) {
        return ['ok' => false, 'error' => 'target must rank above you'];
    }

    $lastSent = (int) query_one(
        'SELECT COALESCE(MAX(created_at), 0) FROM room_effect WHERE room_code = ? AND from_team = ?',
        [$code, $fromTeam]
    );
    if ($now - $lastSent < EFFECT_COOLDOWN_SEC) {
        return ['ok' => false, 'error' => 'cooldown', 'waitSec' => EFFECT_COOLDOWN_SEC - ($now - $lastSent)];
    }

    $pending = (int) query_one(
        'SELECT COUNT(*) FROM room_effect WHERE room_code = ? AND to_team = ? AND delivered = 0',
        [$code, $to]
    );
    if ($pending >= EFFECT_INBOX_MAX) {
        return ['ok' => false, 'error' => 'target inbox full'];
    }

    $stmt = get_db()->prepare(
        'INSERT INTO room_effect (room_code, from_team, to_team, kind, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$code, $fromTeam, $to, $kind, $now]);
    return ['ok' => true, 'kind' => $kind, 'to' => $to];
}

/** ดึงการ์ดป่วนที่ส่งมาถึงทีมนี้แล้วปิดเป็น delivered ในคำขอเดียวกัน (ส่งมอบครั้งเดียว) */
function take_inbox(string $code, string $team): array
{
    $stmt = get_db()->prepare(
        'SELECT id, from_team, kind FROM room_effect
         WHERE room_code = ? AND to_team = ? AND delivered = 0 ORDER BY id'
    );
    $stmt->execute([$code, $team]);
    $rows = $stmt->fetchAll();
    if (!$rows) {
        return [];
    }
    $ids = array_map(static fn (array $r): int => (int) $r['id'], $rows);
    $marks = implode(',', array_fill(0, count($ids), '?'));
    get_db()->prepare("UPDATE room_effect SET delivered = 1 WHERE id IN ({$marks})")->execute($ids);
    return array_map(
        static fn (array $r): array => ['from' => $r['from_team'], 'kind' => $r['kind']],
        $rows
    );
}

/** ชื่อทีมเรียงตามอันดับ (เกณฑ์เดียวกับ room_state) — ใช้ตรวจว่าเป้าหมายนำหน้าเราจริงไหม */
function ranked_team_names(string $code): array
{
    $stmt = get_db()->prepare(
        'SELECT team_name FROM room_team WHERE room_code = ?
         ORDER BY king_coins DESC, coins DESC, COALESCE(finished_at, 9999999999) ASC'
    );
    $stmt->execute([$code]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
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
        'SELECT team_name, king_coins, coins, finished_at, suspect, last_seen, lineup
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
            'lineup' => $row['lineup'] ? explode(',', (string) $row['lineup']) : [],
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

function create_room(string $hostName, array $rules, string $hostToken): string
{
    $payload = json_encode($rules, JSON_UNESCAPED_UNICODE);
    for ($attempt = 0; $attempt < 12; $attempt++) {
        $code = random_room_code();
        $stmt = get_db()->prepare(
            "INSERT INTO room (code, host_name, status, rules, host_token) VALUES (?, ?, 'lobby', ?, ?)"
        );
        try {
            $stmt->execute([$code, $hostName, $payload, $hostToken]);
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

/** เจ้าของห้องเท่านั้นที่กดเริ่ม/จบได้ — ใช้ token ของทีมเจ้าของห้อง ไม่ใช่รหัสครู */
function require_host(string $code, string $token): array
{
    $room = load_room($code);
    if ($token === '' || !hash_equals((string) $room['host_token'], $token)) {
        send_json(['ok' => false, 'error' => 'only the room host can do this'], 403);
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

/** ขุนศึกที่ทีมเลือก — เก็บเป็น csv ของ king id · server ไม่รู้จักรายชื่อพระองค์ จึงตรวจแค่รูปแบบ */
function clean_lineup(mixed $raw, int $max = 4): ?string
{
    if (!is_array($raw)) {
        return null;
    }
    $ids = [];
    foreach (array_slice($raw, 0, max(1, min(4, $max))) as $id) {
        if (is_string($id) && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $id)) {
            $ids[] = $id;
        }
    }
    return $ids ? implode(',', $ids) : null;
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
        // การ์ดป่วนข้ามทีม — ครูบางคนไม่เอาแน่นอน จึงเป็นสวิตช์ตอนสร้างห้อง
        'sabotage' => !empty($raw['sabotage']),
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
    $stale = '(SELECT code FROM room WHERE created_at < (NOW() - INTERVAL ' . ROOM_TTL_HOURS . ' HOUR))';
    $db->exec("DELETE FROM room_effect WHERE room_code IN {$stale}");
    $db->exec("DELETE FROM room_team WHERE room_code IN {$stale}");
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
            host_token VARCHAR(40) NOT NULL DEFAULT '',
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
            lineup VARCHAR(200) NULL,
            last_seen INT NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_room_team (room_code, team_name),
            INDEX idx_room (room_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!get_db()->query("SHOW COLUMNS FROM room_team LIKE 'lineup'")->fetch()) {
        $db->exec("ALTER TABLE room_team ADD COLUMN lineup VARCHAR(200) NULL AFTER suspect");
    }
    // DB เดิมที่สร้างก่อนเลิกใช้ require_admin ยังไม่มีคอลัมน์นี้
    if (!get_db()->query("SHOW COLUMNS FROM room LIKE 'host_token'")->fetch()) {
        $db->exec("ALTER TABLE room ADD COLUMN host_token VARCHAR(40) NOT NULL DEFAULT '' AFTER rules");
    }
    $db->exec(
        "CREATE TABLE IF NOT EXISTS room_effect (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(8) NOT NULL,
            from_team VARCHAR(60) NOT NULL,
            to_team VARCHAR(60) NOT NULL,
            kind VARCHAR(20) NOT NULL,
            created_at INT NOT NULL,
            delivered TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_effect_inbox (room_code, to_team, delivered),
            INDEX idx_effect_sender (room_code, from_team, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}
