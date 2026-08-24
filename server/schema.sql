CREATE TABLE IF NOT EXISTS quiz (
  id VARCHAR(80) PRIMARY KEY,
  king_id VARCHAR(80) NOT NULL,
  difficulty ENUM('easy','medium','hard') NOT NULL,
  reward INT NOT NULL DEFAULT 0,
  time_limit_sec INT NOT NULL DEFAULT 20,
  question TEXT NOT NULL,
  choices JSON NOT NULL,
  explanation TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge (
  id VARCHAR(80) PRIMARY KEY,
  king_id VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  question TEXT NOT NULL,
  choices JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gold_quiz (
  id VARCHAR(80) PRIMARY KEY,
  king_id VARCHAR(80) NOT NULL,
  difficulty ENUM('easy','medium','hard') NOT NULL,
  reward INT NOT NULL DEFAULT 0,
  time_limit_sec INT NOT NULL DEFAULT 20,
  question TEXT NOT NULL,
  choices JSON NOT NULL,
  explanation TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  video_url VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subject_quiz (
  id VARCHAR(80) PRIMARY KEY,
  king_id VARCHAR(80) NOT NULL,
  subject ENUM('thai','math','science','social','health_pe','art','occupation','foreign_language') NOT NULL,
  difficulty ENUM('easy','medium','hard') NOT NULL,
  reward INT NOT NULL DEFAULT 0,
  time_limit_sec INT NOT NULL DEFAULT 20,
  question TEXT NOT NULL,
  choices JSON NOT NULL,
  explanation TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_config (
  config_key VARCHAR(80) PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ช่องกลางให้มือถือ↔tablet คุยกัน (โหมด QR อัตโนมัติ) — challenge อายุสั้น, ล้างเองเมื่อเกิน 1 ชม.
CREATE TABLE IF NOT EXISTS qr_challenge (
  id VARCHAR(40) PRIMARY KEY,
  payload LONGTEXT NULL,
  answered TINYINT(1) NOT NULL DEFAULT 0,
  correct TINYINT(1) NOT NULL DEFAULT 0,
  -- ไอเทมที่ผู้เล่นกดใช้บนมือถือระหว่างตอบ (csv: fiftyFifty,skip) — แท็บเล็ตเอาไปหักจำนวน
  used_items VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── ห้องแข่งออนไลน์ (ดู ROOM-PLAN.md) ──
-- เวลาที่ใช้ตัดสินเกมเก็บเป็น unix timestamp (INT) ที่คิดด้วย time() ของ PHP ฝั่งเดียว
-- ห้ามผสมกับ NOW() ของ MySQL เพราะ timezone อาจไม่ตรงกัน แล้วเวลาแข่งจะเพี้ยนในห้องแข่ง
-- (created_at เป็น TIMESTAMP ได้ เพราะใช้เก็บกวาดห้องเก่าเท่านั้น)
CREATE TABLE IF NOT EXISTS room (
  code VARCHAR(8) PRIMARY KEY,              -- 7MHR42 (ตัวใหญ่ ไม่ใช้ I O 0 1 กันอ่านผิด)
  host_name VARCHAR(80) NOT NULL,           -- ชื่อทีมเจ้าของห้อง (ไม่ใช่ชื่อคน)
  status ENUM('lobby','running','ended') NOT NULL DEFAULT 'lobby',
  rules TEXT NOT NULL,                      -- JSON: durationSec/targetCoins/playersPerTeam/difficulty/sabotage/contentVersion
  host_token VARCHAR(40) NOT NULL DEFAULT '', -- คนที่สร้างห้องเท่านั้นที่กดเริ่ม/จบได้ (ไม่ใช้รหัสครู)
  started_at INT NULL,
  ends_at INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_created (created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_team (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_code VARCHAR(8) NOT NULL,
  team_token VARCHAR(40) NOT NULL,          -- ความลับของเครื่องนั้น — กันทีมอื่นแก้แต้มเรา
  team_name VARCHAR(60) NOT NULL,           -- ชื่อทีม — ห้ามชื่อจริงเด็ก (PDPA)
  king_coins TINYINT NOT NULL DEFAULT 0,    -- คะแนนหลัก
  coins INT NOT NULL DEFAULT 0,             -- เหรียญปกติ (ตัวตัดสินเสมอ)
  finished_at INT NULL,                     -- ถึงเป้าก่อนหมดเวลา
  suspect TINYINT(1) NOT NULL DEFAULT 0,    -- แต้มพุ่งผิดปกติ — ติดธงให้ครูดู ไม่ได้ปฏิเสธ
  lineup VARCHAR(200) NULL,                 -- ขุนศึกที่ทีมเลือก (csv ของ king id) — โชว์ในจอท้าชิง
  last_seen INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_room_team (room_code, team_name),
  INDEX idx_room (room_code)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- การ์ดป่วนข้ามทีม — ส่ง/รับผ่าน action `sync` ที่วิ่งอยู่แล้ว (ไม่มี endpoint แยก)
-- ยิงได้เฉพาะทีมที่ "อันดับสูงกว่าผู้ส่ง" เท่านั้น → กลายเป็นกลไกไล่กวดในตัว
CREATE TABLE IF NOT EXISTS room_effect (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_code VARCHAR(8) NOT NULL,
  from_team VARCHAR(60) NOT NULL,
  to_team VARCHAR(60) NOT NULL,
  kind VARCHAR(20) NOT NULL,          -- storm / block / tax / hardQuiz
  created_at INT NOT NULL,            -- unix time จาก PHP (เหมือนตารางห้อง)
  delivered TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_effect_inbox (room_code, to_team, delivered),
  INDEX idx_effect_sender (room_code, from_team, created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ผลแบบทดสอบก่อนเรียน/หลังเรียน (30 ข้อ) — ครูดูเทียบพัฒนาการรายคนได้
-- POST เปิดให้เด็กส่งได้เลย (ไม่ต้องมีรหัสครู) แต่ GET อ่านทั้งตารางต้องเป็นครูเท่านั้น
-- student_name เป็น optional — ค่าเริ่มต้นส่งชื่อมาด้วย แต่ครูปิดสวิตช์ได้ (แล้วชื่ออยู่แค่ในแท็บเล็ต)
CREATE TABLE IF NOT EXISTS test_result (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mode ENUM('pre','post') NOT NULL,
  student_key VARCHAR(64) NOT NULL,         -- "<ชั้น>|<เลขที่>" ตัวพิมพ์เล็ก — คำนวณฝั่ง server เท่านั้น
  student_no VARCHAR(12) NOT NULL,
  student_room VARCHAR(32) NOT NULL,
  student_name VARCHAR(80) NOT NULL DEFAULT '',
  score INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  duration_sec INT NOT NULL DEFAULT 0,
  answers TEXT NULL,                        -- JSON: index ตัวเลือกที่ตอบ เรียงตามข้อ 1–30 (-1 = ไม่ได้ตอบ)
  by_king TEXT NULL,                        -- JSON: สรุปถูก/ทั้งหมด รายพระองค์
  attempts INT NOT NULL DEFAULT 1,          -- ทำซ้ำกี่ครั้ง (ทับผลเดิม แต่ให้ครูเห็นว่าซ้ำ)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_mode_student (mode, student_key)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO app_config (config_key, config_value)
VALUES ('content_version', '1')
ON DUPLICATE KEY UPDATE config_value = config_value;
