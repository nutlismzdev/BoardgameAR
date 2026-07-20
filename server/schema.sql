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

INSERT INTO app_config (config_key, config_value)
VALUES ('content_version', '1')
ON DUPLICATE KEY UPDATE config_value = config_value;
