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
  rules TEXT NOT NULL,                      -- JSON: durationSec/targetCoins/playersPerTeam/difficulty/contentVersion
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
  last_seen INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_room_team (room_code, team_name),
  INDEX idx_room (room_code)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO app_config (config_key, config_value)
VALUES ('content_version', '1')
ON DUPLICATE KEY UPDATE config_value = config_value;
