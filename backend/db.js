const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/cheltuieli.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT DEFAULT '📦',
    parent_id INTEGER REFERENCES categories(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    counterparty TEXT,
    category_id INTEGER REFERENCES categories(id),
    account_number TEXT,
    currency TEXT DEFAULT 'EUR',
    transaction_type TEXT DEFAULT 'debit',
    source TEXT DEFAULT 'manual',
    import_batch TEXT,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auto_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    match_field TEXT DEFAULT 'description',
    category_id INTEGER NOT NULL REFERENCES categories(id),
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    filename TEXT,
    file_type TEXT,
    transaction_count INTEGER DEFAULT 0,
    imported_at TEXT DEFAULT (datetime('now')),
    month TEXT,
    year INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_batch ON transactions(import_batch);
`);

// Migrations for existing databases
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
try { db.exec("ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id)"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN details TEXT"); } catch {}

// Seed default categories if empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
if (catCount.c === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
  const defaults = [
    ['Groceries',       '#22c55e', '🛒'],
    ['Dining & Cafes',  '#f97316', '🍽️'],
    ['Transport',       '#3b82f6', '🚌'],
    ['Utilities',       '#8b5cf6', '💡'],
    ['Rent & Housing',  '#ef4444', '🏠'],
    ['Healthcare',      '#ec4899', '🏥'],
    ['Entertainment',   '#f59e0b', '🎬'],
    ['Shopping',        '#06b6d4', '🛍️'],
    ['Subscriptions',   '#84cc16', '📱'],
    ['Travel',          '#14b8a6', '✈️'],
    ['Education',       '#a855f7', '📚'],
    ['Savings',         '#10b981', '💰'],
    ['Income',          '#22d3ee', '💵'],
    ['Other',           '#6b7280', '📦'],
  ];
  const insertMany = db.transaction((cats) => cats.forEach(c => insertCat.run(...c)));
  insertMany(defaults);

  // Seed some auto-rules
  const catMap = {};
  db.prepare('SELECT id, name FROM categories').all().forEach(c => catMap[c.name] = c.id);
  const insertRule = db.prepare('INSERT INTO auto_rules (keyword, category_id) VALUES (?, ?)');
  [
    ['Albert Heijn',    catMap['Groceries']],
    ['Jumbo',           catMap['Groceries']],
    ['Lidl',            catMap['Groceries']],
    ['Aldi',            catMap['Groceries']],
    ['NS ',             catMap['Transport']],
    ['OV-chipkaart',    catMap['Transport']],
    ['GVB',             catMap['Transport']],
    ['Spotify',         catMap['Subscriptions']],
    ['Netflix',         catMap['Subscriptions']],
    ['Thuisbezorgd',    catMap['Dining & Cafes']],
    ['Uber Eats',       catMap['Dining & Cafes']],
    ['Huur',            catMap['Rent & Housing']],
    ['Rent',            catMap['Rent & Housing']],
    ['Salaris',         catMap['Income']],
    ['Salary',          catMap['Income']],
  ].forEach(r => insertRule.run(...r));
}

module.exports = db;
