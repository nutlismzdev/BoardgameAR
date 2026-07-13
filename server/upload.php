<?php
require_once __DIR__ . '/lib.php';

handle_cors();
require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send_json(['ok' => false, 'error' => 'method not allowed'], 405);
}

// รองรับ 2 ชนิด: field 'image' (รูปประกอบคำถาม) หรือ 'video' (คลิป AR ทอง)
if (isset($_FILES['image']) && is_array($_FILES['image'])) {
    $file = $_FILES['image'];
    $maxBytes = 10 * 1024 * 1024; // 10 MB
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    $prefix = 'img_';
    $typeErr = 'รองรับเฉพาะ JPG, PNG, WebP, GIF';
    $sizeErr = 'image must be 1 byte - 10 MB';
} elseif (isset($_FILES['video']) && is_array($_FILES['video'])) {
    $file = $_FILES['video'];
    $maxBytes = 200 * 1024 * 1024; // 200 MB
    $allowed = [
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    ];
    $prefix = 'gold_';
    $typeErr = 'รองรับเฉพาะ MP4, WebM, MOV';
    $sizeErr = 'video must be 1 byte - 200 MB';
} else {
    send_json(['ok' => false, 'error' => 'image or video file is required'], 400);
}

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    send_json(['ok' => false, 'error' => 'upload failed'], 400);
}

if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > $maxBytes) {
    send_json(['ok' => false, 'error' => $sizeErr], 400);
}

$tmp = (string) $file['tmp_name'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmp) ?: '';
if (!isset($allowed[$mime])) {
    send_json(['ok' => false, 'error' => $typeErr], 400);
}

$dir = __DIR__ . '/uploads';
if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
    send_json(['ok' => false, 'error' => 'cannot create upload directory'], 500);
}

$filename = $prefix . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
$target = $dir . '/' . $filename;
if (!move_uploaded_file($tmp, $target)) {
    send_json(['ok' => false, 'error' => 'cannot save uploaded file'], 500);
}

send_json(['ok' => true, 'data' => ['url' => 'uploads/' . $filename]]);
