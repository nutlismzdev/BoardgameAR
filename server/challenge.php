<?php
// ช่องกลางให้ "มือถือผู้เล่น" กับ "tablet กลาง" คุยกัน (โหมด QR อัตโนมัติ)
// tablet ลงทะเบียน payload ชั่วคราว → มือถือโหลดคำถามและ POST ผล → tablet poll แล้วเดินเกมต่อ
// challenge id สุ่มใหม่ทุกข้อ และข้อมูลถูกล้างเมื่ออายุเกิน 1 ชั่วโมง
require_once __DIR__ . '/lib.php';

// ไอเทมที่ใช้ในหน้าคำถามได้ (ตรงกับ QUIZ_ITEMS ฝั่งเว็บ) — ชนิดอื่นกดที่แท็บเล็ตอยู่แล้ว
const VALID_QUIZ_ITEMS = ['fiftyFifty', 'skip'];

handle_cors();

ensure_challenge_table();

// เก็บกวาดผลเก่า (กันตารางบวม) — challenge มีอายุสั้น เกิน 1 ชม. ทิ้ง
get_db()->exec('DELETE FROM qr_challenge WHERE created_at < (NOW() - INTERVAL 1 HOUR)');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $body = read_json_body();
    $id = require_string($body, 'id');
    if (!preg_match('/^[A-Za-z0-9_-]{8,40}$/', $id)) {
        send_json(['ok' => false, 'error' => 'invalid id'], 400);
    }
    if (isset($body['challenge']) && is_array($body['challenge'])) {
        $challenge = $body['challenge'];
        $choices = $challenge['c'] ?? null;
        $answer = $challenge['a'] ?? null;
        $validChoices = is_array($choices)
            && count($choices) >= 2
            && count($choices) <= 6
            && count(array_filter($choices, 'is_string')) === count($choices);
        if (!isset($challenge['q']) || !is_string($challenge['q']) || trim($challenge['q']) === '' || !$validChoices || !is_int($answer) || $answer < 0 || $answer >= count($choices)) {
            send_json(['ok' => false, 'error' => 'invalid challenge'], 400);
        }
        $payload = json_encode($challenge, JSON_UNESCAPED_UNICODE);
        if ($payload === false || strlen($payload) > 20000) {
            send_json(['ok' => false, 'error' => 'challenge too large'], 400);
        }
        $stmt = get_db()->prepare(
            'INSERT INTO qr_challenge (id, payload, answered, correct) VALUES (?, ?, 0, 0)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload), created_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$id, $payload]);
        send_json(['ok' => true]);
    }

    // มือถือส่งผลการตอบขึ้นมา
    if (!array_key_exists('correct', $body) || !is_bool($body['correct'])) {
        send_json(['ok' => false, 'error' => 'invalid correct result'], 400);
    }
    $correct = (int) ((bool) ($body['correct'] ?? false));
    // ไอเทมที่กดใช้บนมือถือ — รับเฉพาะชนิดที่รู้จัก (ห้ามเชื่อ client) แล้วเก็บเป็น csv
    $items = [];
    if (isset($body['items']) && is_array($body['items'])) {
        foreach ($body['items'] as $item) {
            if (is_string($item) && in_array($item, VALID_QUIZ_ITEMS, true) && !in_array($item, $items, true)) {
                $items[] = $item;
            }
        }
    }
    $usedItems = $items ? implode(',', $items) : null;
    $stmt = get_db()->prepare(
        'INSERT INTO qr_challenge (id, answered, correct, used_items) VALUES (?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
            correct = IF(answered = 0, VALUES(correct), correct),
            used_items = IF(answered = 0, VALUES(used_items), used_items),
            answered = 1'
    );
    $stmt->execute([$id, $correct, $usedItems]);
    send_json(['ok' => true]);
}

// GET: tablet poll ว่ามีผลหรือยัง
$id = trim((string) ($_GET['id'] ?? ''));
if ($id === '') {
    send_json(['ok' => false, 'error' => 'missing id'], 400);
}
$wantPayload = ($_GET['payload'] ?? '') === '1';
$stmt = get_db()->prepare('SELECT payload, answered, correct, used_items FROM qr_challenge WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if ($row === false) {
    send_json($wantPayload ? ['ok' => false, 'error' => 'challenge not found'] : ['ok' => true, 'answered' => false], $wantPayload ? 404 : 200);
}
if ($wantPayload) {
    $challenge = json_decode((string) ($row['payload'] ?? ''), true);
    if (!is_array($challenge)) {
        send_json(['ok' => false, 'error' => 'challenge payload not found'], 404);
    }
    send_json(['ok' => true, 'challenge' => $challenge]);
}
$used = trim((string) ($row['used_items'] ?? ''));
send_json([
    'ok' => true,
    'answered' => (bool) $row['answered'],
    'correct' => (bool) $row['correct'],
    'items' => $used === '' ? [] : explode(',', $used),
]);

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
            payload LONGTEXT NULL,
            answered TINYINT(1) NOT NULL DEFAULT 0,
            correct TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $columns = get_db()->query('SHOW COLUMNS FROM qr_challenge')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('payload', $columns, true)) {
        get_db()->exec('ALTER TABLE qr_challenge ADD COLUMN payload LONGTEXT NULL AFTER id');
    }
    if (!in_array('answered', $columns, true)) {
        get_db()->exec('ALTER TABLE qr_challenge ADD COLUMN answered TINYINT(1) NOT NULL DEFAULT 0 AFTER payload');
    }
    if (!in_array('used_items', $columns, true)) {
        get_db()->exec('ALTER TABLE qr_challenge ADD COLUMN used_items VARCHAR(64) NULL AFTER correct');
    }
    $done = true;
}
