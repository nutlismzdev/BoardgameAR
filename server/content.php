<?php
require_once __DIR__ . '/lib.php';

handle_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$type = (string) ($_GET['type'] ?? '');
$table = table_for_type($type);

if ($method !== 'GET') {
    require_admin();
}

ensure_schema_for_type($type, $table);

function save_card(string $table, string $type, array $body, bool $isUpdate): void
{
    $id = normalize_id($body['id'] ?? null);
    $kingId = require_string($body, 'kingId');
    // การ์ดความรู้ไม่มีคำถามทบทวนในเกมแล้ว — ปล่อยให้คำถาม/ตัวเลือกว่างได้
    $choices = $type === 'knowledge' ? optional_choices($body['choices'] ?? null) : validate_choices($body['choices'] ?? null);
    $choicesJson = json_encode($choices, JSON_UNESCAPED_UNICODE);

    if ($type === 'knowledge') {
        $params = [
            $id,
            $kingId,
            require_string($body, 'title'),
            require_string($body, 'body'),
            trim((string) ($body['question'] ?? '')),
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
    // การ์ด AR ทอง: คำอธิบายเฉลยไม่บังคับ · ชนิดอื่นยังบังคับ
    $explanation = $type === 'gold' ? trim((string) ($body['explanation'] ?? '')) : require_string($body, 'explanation');
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
