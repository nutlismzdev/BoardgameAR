<?php
// ผลแบบทดสอบก่อนเรียน/หลังเรียน — เก็บรวมทั้งห้องให้ครูดูเทียบพัฒนาการได้
//
// สิทธิ์แบบไม่สมมาตรโดยตั้งใจ:
//   POST (เด็กส่งผลจากแท็บเล็ต) = ไม่ต้องมี token
//   GET  (อ่านผลทั้งห้อง = ข้อมูลนักเรียน) = ต้องเป็นครูเท่านั้น
// เหตุผลเดียวกับห้องแข่ง (ดู CLAUDE.md): รหัสครูคือรหัสที่เข้า CMS ลบการ์ดได้ทั้งระบบ
// การบังคับให้พิมพ์รหัสนั้นหน้าเด็กก่อนส่งข้อสอบ = เพิ่มความเสี่ยง ไม่ได้ลด

require_once __DIR__ . '/lib.php';

const TEST_TOTAL = 30;
const TEST_MODES = ['pre', 'post'];
// กันสแปม/กันเด็กกดรัว — ห้องหนึ่งมีไม่กี่สิบคน เพดานนี้เหลือเฟือ
const TEST_MAX_NEW_PER_HOUR = 400;

handle_cors();
ensure_test_table();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    require_admin();
    $rows = get_db()
        ->query(
            'SELECT mode, student_key, student_no, student_room, student_name, score, total,
                    duration_sec, answers, by_king, attempts,
                    UNIX_TIMESTAMP(created_at) AS created_ts, UNIX_TIMESTAMP(updated_at) AS updated_ts
             FROM test_result
             ORDER BY student_room, LPAD(student_no, 4, "0"), mode'
        )
        ->fetchAll();

    $data = array_map(static function (array $r): array {
        return [
            'mode' => $r['mode'],
            'studentKey' => $r['student_key'],
            'studentNo' => $r['student_no'],
            'studentRoom' => $r['student_room'],
            'studentName' => $r['student_name'] ?? '',
            'score' => (int) $r['score'],
            'total' => (int) $r['total'],
            'durationSec' => (int) $r['duration_sec'],
            'answers' => json_decode($r['answers'] ?? '[]', true) ?: [],
            'byKing' => json_decode($r['by_king'] ?? '[]', true) ?: [],
            'attempts' => (int) $r['attempts'],
            'submittedAt' => ((int) $r['created_ts']) * 1000,
            'updatedAt' => ((int) $r['updated_ts']) * 1000,
        ];
    }, $rows);

    send_json(['ok' => true, 'data' => $data, 'serverTime' => time() * 1000]);
}

if ($method !== 'POST') {
    send_json(['ok' => false, 'error' => 'method not allowed'], 405);
}

$body = read_json_body();

$mode = (string) ($body['mode'] ?? '');
if (!in_array($mode, TEST_MODES, true)) {
    send_json(['ok' => false, 'error' => 'invalid mode'], 400);
}

$no = trim((string) ($body['studentNo'] ?? ''));
$room = trim((string) ($body['studentRoom'] ?? ''));
if ($no === '' || $room === '' || mb_strlen($no) > 12 || mb_strlen($room) > 32) {
    send_json(['ok' => false, 'error' => 'invalid student'], 400);
}

// ชื่อเป็น optional เสมอ — แอปส่งชื่อมาเป็นค่าเริ่มต้น แต่ครูปิดสวิตช์ได้
// (ปิดแล้วเก็บชื่อไว้ในแท็บเล็ตอย่างเดียว) endpoint จึงต้องรับกรณีไม่มีชื่อได้ตลอด
$name = trim((string) ($body['studentName'] ?? ''));
if (mb_strlen($name) > 80) {
    $name = mb_substr($name, 0, 80);
}

// คีย์นักเรียนคำนวณฝั่งเซิร์ฟเวอร์เอง — ห้ามเชื่อค่าที่ client ส่งมา ไม่งั้นทับผลของคนอื่นได้
$key = mb_strtolower($room . '|' . $no);

$answers = $body['answers'] ?? null;
if (!is_array($answers) || count($answers) !== TEST_TOTAL) {
    send_json(['ok' => false, 'error' => 'invalid answers'], 400);
}
$clean = [];
foreach ($answers as $a) {
    if (!is_int($a) || $a < -1 || $a > 5) {
        send_json(['ok' => false, 'error' => 'invalid answers'], 400);
    }
    $clean[] = $a;
}

$total = (int) ($body['total'] ?? TEST_TOTAL);
$score = (int) ($body['score'] ?? 0);
if ($total !== TEST_TOTAL || $score < 0 || $score > $total) {
    send_json(['ok' => false, 'error' => 'invalid score'], 400);
}

$duration = (int) ($body['durationSec'] ?? 0);
if ($duration < 0 || $duration > 86400) {
    $duration = 0;
}

// by_king เป็นข้อมูลสรุปเพื่อความสะดวกของหน้าครู — ผิดเพี้ยนแค่ไหนก็คำนวณใหม่จาก answers ได้
$byKing = is_array($body['byKing'] ?? null) ? $body['byKing'] : [];

$db = get_db();
$recent = (int) $db
    ->query('SELECT COUNT(*) FROM test_result WHERE updated_at > (NOW() - INTERVAL 1 HOUR)')
    ->fetchColumn();
if ($recent > TEST_MAX_NEW_PER_HOUR) {
    send_json(['ok' => false, 'error' => 'ระบบได้รับผลการทำแบบทดสอบจำนวนมากในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง'], 429);
}

// ── กันทำรอบเดิมซ้ำ ──
// ด่านบนแท็บเล็ตกันได้เฉพาะเครื่องเดิม เด็กย้ายไปอีกเครื่องแล้วทำใหม่ยังหลุดได้
// จึงตรวจซ้ำที่นี่: มีผลรอบนี้ของคนนี้อยู่แล้ว = ปฏิเสธ เว้นแต่ครูเปิดโหมดทำซ้ำ (`retake`)
$retake = !empty($body['retake']);
$exists = (bool) (function () use ($db, $mode, $key) {
    $q = $db->prepare('SELECT 1 FROM test_result WHERE mode = ? AND student_key = ?');
    $q->execute([$mode, $key]);
    return $q->fetchColumn();
})();
if ($exists && !$retake) {
    // ⚠️ ต้องมี `code` ให้ฝั่งเว็บแยกออกจาก error ชั่วคราว — ผลที่ค้างในคิวจะได้ถูกทิ้ง
    // ไม่ใช่วนส่งซ้ำไม่รู้จบ (เคสส่งสำเร็จไปแล้วแต่คิวไม่รู้ ก็จะมาเจอ 409 นี้เหมือนกัน)
    send_json([
        'ok' => false,
        'code' => 'already_submitted',
        'error' => 'เลขที่นี้ทำแบบทดสอบรอบนี้ไปแล้ว หากต้องการให้ทำใหม่ กรุณาเปิดโหมดทำซ้ำในโหมดครู',
    ], 409);
}

// คนเดิม + โหมดเดิม = ทับของเดิม แล้วนับจำนวนครั้งไว้ (ครูจะได้เห็นว่ามีการทำซ้ำ)
$stmt = $db->prepare(
    'INSERT INTO test_result
        (mode, student_key, student_no, student_room, student_name, score, total, duration_sec, answers, by_king, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
        student_no = VALUES(student_no),
        student_room = VALUES(student_room),
        student_name = IF(VALUES(student_name) = "", student_name, VALUES(student_name)),
        score = VALUES(score),
        total = VALUES(total),
        duration_sec = VALUES(duration_sec),
        answers = VALUES(answers),
        by_king = VALUES(by_king),
        attempts = attempts + 1'
);
$stmt->execute([
    $mode,
    $key,
    $no,
    $room,
    $name,
    $score,
    $total,
    $duration,
    json_encode($clean),
    json_encode($byKing, JSON_UNESCAPED_UNICODE),
]);

send_json(['ok' => true, 'serverTime' => time() * 1000]);

// ── schema (auto-migrate แบบเดียวกับ qr_challenge ใน challenge.php) ──
function ensure_test_table(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    get_db()->exec(
        'CREATE TABLE IF NOT EXISTS test_result (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mode ENUM("pre","post") NOT NULL,
            student_key VARCHAR(64) NOT NULL,
            student_no VARCHAR(12) NOT NULL,
            student_room VARCHAR(32) NOT NULL,
            student_name VARCHAR(80) NOT NULL DEFAULT "",
            score INT NOT NULL DEFAULT 0,
            total INT NOT NULL DEFAULT 0,
            duration_sec INT NOT NULL DEFAULT 0,
            answers TEXT NULL,
            by_king TEXT NULL,
            attempts INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_mode_student (mode, student_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $done = true;
}
