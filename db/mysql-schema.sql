-- ============================================================================
-- Cheltuieli — MySQL Schema
-- ============================================================================
-- Mirrors backend/db.js (SQLite). Target: MySQL 8.0+ / MariaDB 10.5+
--
-- Usage:
--   mysql -u root -p < db/mysql-schema.sql
--
-- Or against an existing database:
--   mysql -u <user> -p <database> < db/mysql-schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS cheltuieli
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cheltuieli;

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL UNIQUE,
  color       VARCHAR(20)   NOT NULL DEFAULT '#6366f1',
  icon        VARCHAR(20)   DEFAULT '📦',
  parent_id   INT           DEFAULT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent
    FOREIGN KEY (parent_id) REFERENCES categories(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  iban        VARCHAR(64)   NOT NULL UNIQUE,
  color       VARCHAR(20)   DEFAULT '#6366f1',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  date              DATE          NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  description       TEXT,
  counterparty      VARCHAR(255),
  details           TEXT,
  category_id       INT           DEFAULT NULL,
  account_id        INT           DEFAULT NULL,
  account_number    VARCHAR(64),
  currency          VARCHAR(8)    DEFAULT 'EUR',
  transaction_type  VARCHAR(16)   DEFAULT 'debit',   -- 'debit' or 'credit'
  source            VARCHAR(32)   DEFAULT 'manual',  -- 'manual' or 'import'
  import_batch      VARCHAR(64),
  raw_data          TEXT,
  is_transfer       TINYINT(1)    DEFAULT 0,
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_tx_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_transactions_date        ON transactions(date);
CREATE INDEX idx_transactions_category    ON transactions(category_id);
CREATE INDEX idx_transactions_batch       ON transactions(import_batch);
CREATE INDEX idx_transactions_transfer    ON transactions(date, amount, account_id);
CREATE INDEX idx_transactions_is_transfer ON transactions(is_transfer);

CREATE TABLE IF NOT EXISTS auto_rules (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  keyword      VARCHAR(255) NOT NULL,
  match_field  VARCHAR(32)  DEFAULT 'description',
  category_id  INT          NOT NULL,
  priority     INT          DEFAULT 0,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rule_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  `key`   VARCHAR(64) PRIMARY KEY,
  value   TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS import_batches (
  id                 VARCHAR(64) PRIMARY KEY,
  filename           VARCHAR(255),
  file_type          VARCHAR(32),
  transaction_count  INT       DEFAULT 0,
  imported_at        DATETIME  DEFAULT CURRENT_TIMESTAMP,
  month              VARCHAR(2),
  year               INT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(64)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  token       VARCHAR(128)  NOT NULL UNIQUE,
  expires_at  DATETIME      NOT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Seed Data ──────────────────────────────────────────────────────────────

-- Default settings (idempotent via INSERT IGNORE)
INSERT IGNORE INTO settings (`key`, value) VALUES
  ('session_timeout_minutes', '30'),
  ('default_currency',        'EUR'),
  ('fx_RON',                  '0.2007'),
  ('fx_USD',                  '0.9200'),
  ('fx_EUR',                  '1.0000'),
  ('salary_keywords',         'Amazon,Workiva');

-- Default accounts (customize IBANs to match your real accounts)
INSERT IGNORE INTO accounts (name, iban, color) VALUES
  ('Current Account', '865474001', '#3b82f6'),
  ('Savings',         '869898825', '#22c55e'),
  ('Rent Deposit',    '880287152', '#f59e0b'),
  ('Rent Income',     '867423439', '#8b5cf6');

-- Default categories (idempotent via INSERT IGNORE on UNIQUE name)
INSERT IGNORE INTO categories (name, color, icon) VALUES
  ('Groceries',      '#22c55e', '🛒'),
  ('Dining & Cafes', '#f97316', '🍽️'),
  ('Transport',      '#3b82f6', '🚌'),
  ('Utilities',      '#8b5cf6', '💡'),
  ('Rent & Housing', '#ef4444', '🏠'),
  ('Healthcare',     '#ec4899', '🏥'),
  ('Entertainment',  '#f59e0b', '🎬'),
  ('Shopping',       '#06b6d4', '🛍️'),
  ('Subscriptions',  '#84cc16', '📱'),
  ('Travel',         '#14b8a6', '✈️'),
  ('Education',      '#a855f7', '📚'),
  ('Savings',        '#10b981', '💰'),
  ('Income',         '#22d3ee', '💵'),
  ('Other',          '#6b7280', '📦');

-- Default auto-rules (keyword → category)
-- Only seeded if the auto_rules table is empty
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Albert Heijn', id FROM categories WHERE name='Groceries'
  AND NOT EXISTS (SELECT 1 FROM auto_rules LIMIT 1);
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Jumbo', id FROM categories WHERE name='Groceries'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Jumbo');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Lidl', id FROM categories WHERE name='Groceries'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Lidl');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Aldi', id FROM categories WHERE name='Groceries'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Aldi');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'NS ', id FROM categories WHERE name='Transport'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='NS ');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'OV-chipkaart', id FROM categories WHERE name='Transport'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='OV-chipkaart');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'GVB', id FROM categories WHERE name='Transport'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='GVB');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Spotify', id FROM categories WHERE name='Subscriptions'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Spotify');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Netflix', id FROM categories WHERE name='Subscriptions'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Netflix');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Thuisbezorgd', id FROM categories WHERE name='Dining & Cafes'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Thuisbezorgd');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Uber Eats', id FROM categories WHERE name='Dining & Cafes'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Uber Eats');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Huur', id FROM categories WHERE name='Rent & Housing'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Huur');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Rent', id FROM categories WHERE name='Rent & Housing'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Rent');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Salaris', id FROM categories WHERE name='Income'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Salaris');
INSERT INTO auto_rules (keyword, category_id)
SELECT 'Salary', id FROM categories WHERE name='Income'
  AND NOT EXISTS (SELECT 1 FROM auto_rules WHERE keyword='Salary');

-- Default admin user (password: 'admin' bcrypt hash with cost 10).
-- CHANGE THIS IMMEDIATELY after first login.
INSERT IGNORE INTO users (username, password_hash) VALUES
  ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- ─── Notes on SQLite → MySQL differences ────────────────────────────────────
-- 1. SQLite stores date as TEXT (ISO YYYY-MM-DD); MySQL uses DATE type.
-- 2. SQLite uses REAL for amount; MySQL uses DECIMAL(14,2) for exact precision.
-- 3. SQLite INSERT OR IGNORE → MySQL INSERT IGNORE.
-- 4. SQLite datetime('now') → MySQL CURRENT_TIMESTAMP.
-- 5. SQLite strftime('%Y-%m', date) → MySQL DATE_FORMAT(date, '%Y-%m').
-- 6. SQLite instr(haystack, needle) > 0 → MySQL LOCATE(needle, haystack) > 0
--    (or `haystack LIKE CONCAT('%', needle, '%')`).
-- 7. `key` is a reserved word in MySQL — must be backtick-quoted.
-- 8. utf8mb4 is required to support emoji characters in category icons.
-- 9. The app code in backend/db.js uses better-sqlite3; to use MySQL you'd need
--    to swap it for mysql2 or similar and adjust parameter binding (? still works)
--    plus any SQLite-specific SQL (dates, LIKE with instr, etc.) in server.js.
