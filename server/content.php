<?php
require_once __DIR__ . '/lib.php';

handle_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$type = (string) ($_GET['type'] ?? '');
$table = table_for_type($type);

if ($method !== 'GET') {
    require_admin();
}

if ($type === 'gold') {
    ensure_gold_video_column();
}
if ($type === 'subject') {
    ensure_subject_table();
}
// ภาพประกอบคำถาม — รองรับทุกชนิดคำถาม (quiz/gold/subject) ยกเว้น knowledge
if ($type !== 'knowledge' && $type !== '') {
    ensure_image_column($table);
}

const VALID_SUBJECTS = ['social', 'math', 'science', 'art', 'health_pe', 'foreign_language'];

function ensure_gold_video_column(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $stmt = get_db()->query("SHOW COLUMNS FROM gold_quiz LIKE 'video_url'");
    if (!$stmt->fetch()) {
        get_db()->exec('ALTER TABLE gold_quiz ADD COLUMN video_url VARCHAR(255) NULL AFTER explanation');
    }
    $done = true;
}

// เพิ่มคอลัมน์ image_url ให้ตารางคำถาม (quiz/gold_quiz/subject_quiz) อัตโนมัติสำหรับ DB เดิม
// $table มาจาก table_for_type() (whitelist) จึงปลอดภัยกับการ interpolate
function ensure_image_column(string $table): void
{
    static $done = [];
    if (isset($done[$table])) {
        return;
    }
    $stmt = get_db()->query("SHOW COLUMNS FROM {$table} LIKE 'image_url'");
    if (!$stmt->fetch()) {
        get_db()->exec("ALTER TABLE {$table} ADD COLUMN image_url VARCHAR(255) NULL AFTER explanation");
    }
    $done[$table] = true;
}

// สร้างตาราง subject_quiz อัตโนมัติสำหรับฐานข้อมูลเดิมที่ยังไม่ได้รัน schema.sql ใหม่
function ensure_subject_table(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    get_db()->exec(
        "CREATE TABLE IF NOT EXISTS subject_quiz (
            id VARCHAR(80) PRIMARY KEY,
            king_id VARCHAR(80) NOT NULL,
            subject ENUM('social','math','science','art','health_pe','foreign_language') NOT NULL,
            difficulty ENUM('easy','medium','hard') NOT NULL,
            reward INT NOT NULL DEFAULT 0,
            time_limit_sec INT NOT NULL DEFAULT 20,
            question TEXT NOT NULL,
            choices JSON NOT NULL,
            explanation TEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    $done = true;
}

function db_to_card(array $row, string $type): array
{
    $choices = json_decode((string) $row['choices'], true);
    if (!is_array($choices)) {
        $choices = [];
    }
    if ($type === 'knowledge') {
        return [
            'id' => $row['id'],
            'kingId' => $row['king_id'],
            'title' => $row['title'],
            'body' => $row['body'],
            'question' => $row['question'],
            'choices' => $choices,
        ];
    }
    $card = [
        'id' => $row['id'],
        'kingId' => $row['king_id'],
        'difficulty' => $row['difficulty'],
        'reward' => (int) $row['reward'],
        'timeLimitSec' => (int) $row['time_limit_sec'],
        'question' => $row['question'],
        'choices' => $choices,
        'explanation' => $row['explanation'],
    ];
    $card['imageUrl'] = $row['image_url'] ?? '';
    if ($type === 'gold') {
        $card['videoUrl'] = $row['video_url'] ?? '';
    }
    if ($type === 'subject') {
        $card['subject'] = $row['subject'];
    }
    return $card;
}

function list_cards(string $table, string $type): array
{
    $order = match ($type) {
        'knowledge' => 'king_id, title, id',
        'subject' => 'king_id, subject, difficulty, id',
        default => 'king_id, difficulty, id',
    };
    $stmt = get_db()->query("SELECT * FROM {$table} ORDER BY {$order}");
    return array_map(fn ($row) => db_to_card($row, $type), $stmt->fetchAll());
}

function normalize_id(?string $id): string
{
    $clean = trim((string) $id);
    if ($clean === '') {
        $clean = 'card_' . bin2hex(random_bytes(8));
    }
    if (!preg_match('/^[a-zA-Z0-9_-]{3,80}$/', $clean)) {
        send_json(['ok' => false, 'error' => 'id must be 3-80 letters, numbers, _ or -'], 400);
    }
    return $clean;
}

function save_card(string $table, string $type, array $body, bool $isUpdate): void
{
    $id = normalize_id($body['id'] ?? null);
    $kingId = require_string($body, 'kingId');
    $choices = validate_choices($body['choices'] ?? null);
    $choicesJson = json_encode($choices, JSON_UNESCAPED_UNICODE);

    if ($type === 'knowledge') {
        $params = [
            $id,
            $kingId,
            require_string($body, 'title'),
            require_string($body, 'body'),
            require_string($body, 'question'),
            $choicesJson,
        ];
        if ($isUpdate) {
            $stmt = get_db()->prepare(
                "UPDATE {$table}
                 SET king_id = ?, title = ?, body = ?, question = ?, choices = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $stmt->execute([$params[1], $params[2], $params[3], $params[4], $params[5], $id]);
        } else {
            $stmt = get_db()->prepare(
                "INSERT INTO {$table} (id, king_id, title, body, question, choices) VALUES (?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute($params);
        }
        return;
    }

    $difficulty = (string) ($body['difficulty'] ?? '');
    if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
        send_json(['ok' => false, 'error' => 'invalid difficulty'], 400);
    }
    $reward = max(0, (int) ($body['reward'] ?? 0));
    $timeLimit = max(5, (int) ($body['timeLimitSec'] ?? 20));
    $question = require_string($body, 'question');
    $explanation = require_string($body, 'explanation');
    $videoUrl = $type === 'gold' ? trim((string) ($body['videoUrl'] ?? '')) : null;
    $subject = null;
    if ($type === 'subject') {
        $subject = (string) ($body['subject'] ?? '');
        if (!in_array($subject, VALID_SUBJECTS, true)) {
            send_json(['ok' => false, 'error' => 'invalid subject'], 400);
        }
    }

    if ($isUpdate) {
        if ($type === 'gold') {
            $stmt = get_db()->prepare(
                "UPDATE {$table}
                 SET king_id = ?, difficulty = ?, reward = ?, time_limit_sec = ?, question = ?, choices = ?, explanation = ?, video_url = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $stmt->execute([$kingId, $difficulty, $reward, $timeLimit, $question, $choicesJson, $explanation, $videoUrl, $id]);
        } elseif ($type === 'subject') {
            $stmt = get_db()->prepare(
                "UPDATE {$table}
                 SET king_id = ?, subject = ?, difficulty = ?, reward = ?, time_limit_sec = ?, question = ?, choices = ?, explanation = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $stmt->execute([$kingId, $subject, $difficulty, $reward, $timeLimit, $question, $choicesJson, $explanation, $id]);
        } else {
            $stmt = get_db()->prepare(
                "UPDATE {$table}
                 SET king_id = ?, difficulty = ?, reward = ?, time_limit_sec = ?, question = ?, choices = ?, explanation = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $stmt->execute([$kingId, $difficulty, $reward, $timeLimit, $question, $choicesJson, $explanation, $id]);
        }
    } else {
        if ($type === 'gold') {
            $stmt = get_db()->prepare(
                "INSERT INTO {$table} (id, king_id, difficulty, reward, time_limit_sec, question, choices, explanation, video_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([$id, $kingId, $difficulty, $reward, $timeLimit, $question, $choicesJson, $explanation, $videoUrl]);
        } elseif ($type === 'subject') {
            $stmt = get_db()->prepare(
                "INSERT INTO {$table} (id, king_id, subject, difficulty, reward, time_limit_sec, question, choices, explanation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([$id, $kingId, $subject, $difficulty, $reward, $timeLimit, $question, $choicesJson, $explanation]);
        } else {
            $stmt = get_db()->prepare(
                "INSERT INTO {$table} (id, king_id, difficulty, reward, time_limit_sec, question, choices, explanation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([$id, $kingId, $difficulty, $reward, $timeLimit, $question, $choicesJson, $explanation]);
        }
    }

    // ภาพประกอบคำถาม — อัปเดตแยกแบบ uniform ทุกชนิด (ไม่ต้องแก้ทุก query ด้านบน)
    $imageUrl = trim((string) ($body['imageUrl'] ?? ''));
    $stmt = get_db()->prepare("UPDATE {$table} SET image_url = ? WHERE id = ?");
    $stmt->execute([$imageUrl, $id]);
}

if ($method === 'GET') {
    send_json(['ok' => true, 'data' => list_cards($table, $type), 'version' => content_version()]);
}

if ($method === 'POST' || $method === 'PUT') {
    try {
        save_card($table, $type, read_json_body(), $method === 'PUT');
        $version = bump_content_version();
        send_json(['ok' => true, 'data' => list_cards($table, $type), 'version' => $version]);
    } catch (PDOException $e) {
        $status = str_contains($e->getMessage(), 'Duplicate') ? 409 : 500;
        send_json(['ok' => false, 'error' => $status === 409 ? 'id already exists' : 'save failed'], $status);
    }
}

if ($method === 'DELETE') {
    $id = normalize_id($_GET['id'] ?? null);
    $stmt = get_db()->prepare("DELETE FROM {$table} WHERE id = ?");
    $stmt->execute([$id]);
    $version = bump_content_version();
    send_json(['ok' => true, 'data' => list_cards($table, $type), 'version' => $version]);
}

send_json(['ok' => false, 'error' => 'method not allowed'], 405);
