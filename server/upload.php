<?php
require_once __DIR__ . '/lib.php';

handle_cors();
require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send_json(['ok' => false, 'error' => 'method not allowed'], 405);
}

if (!isset($_FILES['video']) || !is_array($_FILES['video'])) {
    send_json(['ok' => false, 'error' => 'video file is required'], 400);
}

$file = $_FILES['video'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    send_json(['ok' => false, 'error' => 'upload failed'], 400);
}

$maxBytes = 200 * 1024 * 1024;
if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > $maxBytes) {
    send_json(['ok' => false, 'error' => 'video must be 1 byte - 200 MB'], 400);
}

$tmp = (string) $file['tmp_name'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmp) ?: '';
$allowed = [
    'video/mp4' => 'mp4',
    'video/webm' => 'webm',
    'video/quicktime' => 'mov',
];
if (!isset($allowed[$mime])) {
    send_json(['ok' => false, 'error' => 'รองรับเฉพาะ MP4, WebM, MOV'], 400);
}

$dir = __DIR__ . '/uploads';
if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
    send_json(['ok' => false, 'error' => 'cannot create upload directory'], 500);
}

$filename = 'gold_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
$target = $dir . '/' . $filename;
if (!move_uploaded_file($tmp, $target)) {
    send_json(['ok' => false, 'error' => 'cannot save uploaded file'], 500);
}

send_json(['ok' => true, 'data' => ['url' => 'uploads/' . $filename]]);
