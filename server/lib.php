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
