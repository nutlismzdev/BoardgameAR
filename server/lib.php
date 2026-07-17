<?php
require_once __DIR__ . '/db.php';

function send_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function handle_cors(): void
{
    $config = get_config();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, $config['allowed_origins'] ?? [], true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        send_json(['ok' => false, 'error' => 'invalid json body'], 400);
    }
    return $data;
}

function base64url_encode_json(array $payload): string
{
    return rtrim(strtr(base64_encode(json_encode($payload, JSON_UNESCAPED_UNICODE)), '+/', '-_'), '=');
}

function base64url_decode_json(string $value): ?array
{
    $json = base64_decode(strtr($value, '-_', '+/'), true);
    if ($json === false) {
        return null;
    }
    $payload = json_decode($json, true);
    return is_array($payload) ? $payload : null;
}

function sign_token(array $payload): string
{
    $secret = (string) (get_config()['token_secret'] ?? '');
    $body = base64url_encode_json($payload);
    $sig = hash_hmac('sha256', $body, $secret);
    return "{$body}.{$sig}";
}

function verify_token(?string $token): ?array
{
    if (!$token || !str_contains($token, '.')) {
        return null;
    }
    [$body, $sig] = explode('.', $token, 2);
    $expected = hash_hmac('sha256', $body, (string) (get_config()['token_secret'] ?? ''));
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $payload = base64url_decode_json($body);
    if (!$payload || (int) ($payload['exp'] ?? 0) < time()) {
        return null;
    }
    return $payload;
}

function require_admin(): array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $token = preg_match('/^Bearer\s+(.+)$/i', $header, $m) ? $m[1] : null;
    $payload = verify_token($token);
    if (!$payload || ($payload['role'] ?? '') !== 'admin') {
        send_json(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    return $payload;
}

function app_config_value(string $key, ?string $fallback = null): ?string
{
    $stmt = get_db()->prepare('SELECT config_value FROM app_config WHERE config_key = ?');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();
    return $value === false ? $fallback : (string) $value;
}

function set_app_config_value(string $key, string $value): void
{
    $stmt = get_db()->prepare(
        'INSERT INTO app_config (config_key, config_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$key, $value]);
}

function content_version(): int
{
    return (int) app_config_value('content_version', '1');
}

function bump_content_version(): int
{
    $next = content_version() + 1;
    set_app_config_value('content_version', (string) $next);
    return $next;
}

function require_string(array $data, string $key): string
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '') {
        send_json(['ok' => false, 'error' => "missing {$key}"], 400);
    }
    return $value;
}

function validate_choices(mixed $choices): array
{
    if (!is_array($choices) || count($choices) < 2) {
        send_json(['ok' => false, 'error' => 'choices must contain at least 2 items'], 400);
    }
    $clean = [];
    $hasCorrect = false;
    foreach ($choices as $choice) {
        if (!is_array($choice)) {
            send_json(['ok' => false, 'error' => 'invalid choice'], 400);
        }
        $text = trim((string) ($choice['text'] ?? ''));
        $correct = (bool) ($choice['correct'] ?? false);
        if ($text === '') {
            send_json(['ok' => false, 'error' => 'choice text is required'], 400);
        }
        $hasCorrect = $hasCorrect || $correct;
        $clean[] = ['text' => $text, 'correct' => $correct];
    }
    if (!$hasCorrect) {
        send_json(['ok' => false, 'error' => 'at least one choice must be correct'], 400);
    }
    return $clean;
}

// ตัวเลือกแบบไม่บังคับ (การ์ดความรู้) — ว่างได้ แต่ถ้ากรอกมาต้องถูกกติกาเดิม
function optional_choices(mixed $choices): array
{
    if (!is_array($choices) || count($choices) === 0) {
        return [];
    }
    return validate_choices($choices);
}

function table_for_type(string $type): string
{
    return match ($type) {
        'quiz' => 'quiz',
        'knowledge' => 'knowledge',
        'gold' => 'gold_quiz',
        'subject' => 'subject_quiz',
        default => send_json(['ok' => false, 'error' => 'invalid content type'], 400),
    };
}

const VALID_SUBJECTS = ['social', 'math', 'science', 'art', 'health_pe', 'foreign_language'];

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

// เตรียมตาราง/คอลัมน์ให้พร้อมตามชนิดเนื้อหา — เรียกก่อนแตะ DB ทุก endpoint ที่อ่าน/เขียนการ์ด
function ensure_schema_for_type(string $type, string $table): void
{
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
