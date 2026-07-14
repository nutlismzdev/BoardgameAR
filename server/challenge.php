<?php
// ช่องกลางให้ "มือถือผู้เล่น" กับ "tablet กลาง" คุยกัน (โหมด QR อัตโนมัติ)
// มือถือ POST ผลการตอบ (ถูก/ผิด) ขึ้นมา → tablet GET (poll) มารับ แล้วเดินเกมต่อเอง
// โหมดเชื่อใจ: ผู้เล่นตรวจคำตอบในเครื่องตัวเองแล้ว server แค่ส่งต่อผล ไม่เก็บเฉลย
require_once __DIR__ . '/lib.php';

handle_cors();

ensure_challenge_table();

// เก็บกวาดผลเก่า (กันตารางบวม) — challenge มีอายุสั้น เกิน 1 ชม. ทิ้ง
get_db()->exec('DELETE FROM qr_challenge WHERE created_at < (NOW() - INTERVAL 1 HOUR)');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    // มือถือส่งผลการตอบขึ้นมา
    $body = read_json_body();
    $id = require_string($body, 'id');
    if (strlen($id) > 40) {
        send_json(['ok' => false, 'error' => 'invalid id'], 400);
    }
    $correct = (int) ((bool) ($body['correct'] ?? false));
    $stmt = get_db()->prepare(
        'INSERT INTO qr_challenge (id, correct) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE correct = VALUES(correct)'
    );
    $stmt->execute([$id, $correct]);
    send_json(['ok' => true]);
}

// GET: tablet poll ว่ามีผลหรือยัง
$id = trim((string) ($_GET['id'] ?? ''));
if ($id === '') {
    send_json(['ok' => false, 'error' => 'missing id'], 400);
}
$stmt = get_db()->prepare('SELECT correct FROM qr_challenge WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if ($row === false) {
    send_json(['ok' => true, 'answered' => false]);
}
send_json(['ok' => true, 'answered' => true, 'correct' => (bool) $row['correct']]);

// สร้างตารางอัตโนมัติสำหรับ DB เดิม (ฟังก์ชัน top-level ถูก hoist — เรียกก่อนนิยามได้)
function ensure_challenge_table(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    get_db()->exec(
        'CREATE TABLE IF NOT EXISTS qr_challenge (
            id VARCHAR(40) PRIMARY KEY,
            correct TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $done = true;
}
