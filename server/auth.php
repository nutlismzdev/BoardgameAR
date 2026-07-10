<?php
require_once __DIR__ . '/lib.php';

handle_cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send_json(['ok' => false, 'error' => 'method not allowed'], 405);
}

$body = read_json_body();
$password = (string) ($body['password'] ?? '');
if ($password === '') {
    send_json(['ok' => false, 'error' => 'password is required'], 400);
}

$config = get_config();
$dbHash = app_config_value('admin_password_hash');
$configHash = (string) ($config['admin_password_hash'] ?? '');
$hash = $dbHash && !str_contains($dbHash, 'REPLACE_WITH') ? $dbHash : $configHash;
if (!$hash || !password_verify($password, $hash)) {
    send_json(['ok' => false, 'error' => 'invalid password'], 401);
}

$ttlHours = max(1, (int) ($config['token_ttl_hours'] ?? 12));
$exp = time() + ($ttlHours * 3600);
$token = sign_token(['role' => 'admin', 'iat' => time(), 'exp' => $exp]);

send_json(['ok' => true, 'token' => $token, 'expiresAt' => $exp]);
