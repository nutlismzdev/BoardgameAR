<?php
// นำเข้าการ์ดทีละหลายใบ (จากไฟล์ Excel ที่เว็บอ่านและแปลงเป็น JSON มาแล้ว)
// body: { type: quiz|knowledge|gold|subject, mode: upsert|replace, rows: [card, ...] }
require_once __DIR__ . '/lib.php';

handle_cors();
require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send_json(['ok' => false, 'error' => 'method not allowed'], 405);
}

const IMPORT_MAX_ROWS = 1000;

$body = read_json_body();
$type = (string) ($body['type'] ?? '');
$table = table_for_type($type);
$mode = (string) ($body['mode'] ?? 'upsert');
if (!in_array($mode, ['upsert', 'replace'], true)) {
    send_json(['ok' => false, 'error' => 'invalid mode'], 400);
}

$rows = $body['rows'] ?? null;
if (!is_array($rows) || count($rows) === 0) {
    send_json(['ok' => false, 'error' => 'rows is required'], 400);
}
if (count($rows) > IMPORT_MAX_ROWS) {
    send_json(['ok' => false, 'error' => 'rows must not exceed ' . IMPORT_MAX_ROWS], 400);
}

ensure_schema_for_type($type, $table);

// ตรวจซ้ำฝั่ง server เสมอ — ฝั่งเว็บตรวจไว้แล้วก็จริง แต่ endpoint นี้รับ JSON ตรง ๆ ได้
function clean_import_row(array $row, string $type, int $index): array
{
    $where = 'แถวที่ ' . ($index + 1);
    $id = trim((string) ($row['id'] ?? ''));
    if ($id === '') {
        $id = 'card_' . bin2hex(random_bytes(8));
    }
    if (!preg_match('/^[a-zA-Z0-9_-]{3,80}$/', $id)) {
        send_json(['ok' => false, 'error' => "{$where}: รหัสการ์ดไม่ถูกรูปแบบ"], 400);
    }
    $kingId = trim((string) ($row['kingId'] ?? ''));
    if ($kingId === '') {
        send_json(['ok' => false, 'error' => "{$where}: ไม่มีพระองค์"], 400);
    }

    if ($type === 'knowledge') {
        $title = trim((string) ($row['title'] ?? ''));
        $bodyText = trim((string) ($row['body'] ?? ''));
        if ($title === '' || $bodyText === '') {
            send_json(['ok' => false, 'error' => "{$where}: ต้องมีชื่อการ์ดและเนื้อหา"], 400);
        }
        return [
            'id' => $id,
            'king_id' => $kingId,
            'title' => $title,
            'body' => $bodyText,
            'question' => trim((string) ($row['question'] ?? '')),
            'choices' => json_encode(optional_choices($row['choices'] ?? null), JSON_UNESCAPED_UNICODE),
        ];
    }

    $difficulty = (string) ($row['difficulty'] ?? '');
    if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
        send_json(['ok' => false, 'error' => "{$where}: ระดับคำถามไม่ถูกต้อง"], 400);
    }
    $question = trim((string) ($row['question'] ?? ''));
    $explanation = trim((string) ($row['explanation'] ?? ''));
    if ($question === '') {
        send_json(['ok' => false, 'error' => "{$where}: ต้องมีคำถาม"], 400);
    }
    // การ์ด AR ทอง: คำอธิบายเฉลยไม่บังคับ · ชนิดอื่นยังบังคับ
    if ($explanation === '' && $type !== 'gold') {
        send_json(['ok' => false, 'error' => "{$where}: ต้องมีคำอธิบายเฉลย"], 400);
    }

    $card = [
        'id' => $id,
        'king_id' => $kingId,
        'difficulty' => $difficulty,
        'reward' => max(0, (int) ($row['reward'] ?? 0)),
        'time_limit_sec' => max(5, (int) ($row['timeLimitSec'] ?? 20)),
        'question' => $question,
        'choices' => json_encode(validate_choices($row['choices'] ?? null), JSON_UNESCAPED_UNICODE),
        'explanation' => $explanation,
        'image_url' => trim((string) ($row['imageUrl'] ?? '')),
    ];

    if ($type === 'gold') {
        $card['video_url'] = trim((string) ($row['videoUrl'] ?? ''));
    }
    if ($type === 'subject') {
        $subject = (string) ($row['subject'] ?? '');
        if (!in_array($subject, VALID_SUBJECTS, true)) {
            send_json(['ok' => false, 'error' => "{$where}: วิชาไม่ถูกต้อง"], 400);
        }
        $card['subject'] = $subject;
    }
    return $card;
}

$clean = [];
foreach (array_values($rows) as $index => $row) {
    if (!is_array($row)) {
        send_json(['ok' => false, 'error' => 'แถวที่ ' . ($index + 1) . ': รูปแบบข้อมูลไม่ถูกต้อง'], 400);
    }
    $clean[] = clean_import_row($row, $type, $index);
}

// ทุกแถวผ่านแล้วค่อยแตะ DB — ถ้าพังกลางทางให้ rollback ทั้งชุด ไม่ทิ้งข้อมูลครึ่ง ๆ กลาง ๆ
$db = get_db();
$db->beginTransaction();
try {
    if ($mode === 'replace') {
        $db->exec("DELETE FROM {$table}");
    }

    $columns = array_keys($clean[0]);
    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $columnList = implode(', ', $columns);
    // upsert: id ซ้ำ = เขียนทับของเดิม · replace: ล้างตารางไปแล้ว insert เฉย ๆ ก็พอ
    $updates = implode(', ', array_map(fn ($col) => "{$col} = VALUES({$col})", array_filter($columns, fn ($col) => $col !== 'id')));
    $sql = "INSERT INTO {$table} ({$columnList}) VALUES ({$placeholders})
            ON DUPLICATE KEY UPDATE {$updates}, updated_at = CURRENT_TIMESTAMP";
    $stmt = $db->prepare($sql);

    $inserted = 0;
    $updated = 0;
    foreach ($clean as $card) {
        $stmt->execute(array_values($card));
        // MySQL คืน rowCount 1 = insert ใหม่, 2 = อัปเดตทับ, 0 = ค่าเหมือนเดิมเป๊ะ
        if ($stmt->rowCount() === 1) {
            $inserted++;
        } else {
            $updated++;
        }
    }

    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    send_json(['ok' => false, 'error' => 'import failed'], 500);
}

$version = bump_content_version();
send_json([
    'ok' => true,
    'data' => list_cards($table, $type),
    'version' => $version,
    'summary' => ['inserted' => $inserted, 'updated' => $updated, 'total' => count($clean)],
]);
