<?php
// สร้างการเชื่อมต่อ PDO ไปยัง MySQL (ใช้ prepared statements ทุกที่ กัน SQL injection)

function get_config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!file_exists($path)) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'missing config.php (คัดลอกจาก config.example.php)']);
            exit;
        }
        $config = require $path;
    }
    return $config;
}

function get_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = get_config();
        $dsn = "mysql:host={$c['db_host']};dbname={$c['db_name']};charset={$c['db_charset']}";
        try {
            $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'db connection failed']);
            exit;
        }
    }
    return $pdo;
}
