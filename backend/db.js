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

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    iban TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
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
try { db.exec("ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id)"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN is_transfer INTEGER DEFAULT 0"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_transfer ON transactions(date, amount, account_id)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_is_transfer ON transactions(is_transfer)"); } catch {}

// Seed default settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
if (settingsCount === 0) {
  const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  [
    ['session_timeout_minutes', '30'],
    ['default_currency', 'EUR'],
    ['fx_RON', '0.2007'],   // 1 RON = ~0.20 EUR
    ['fx_USD', '0.9200'],   // 1 USD = ~0.92 EUR
    ['fx_EUR', '1.0000'],
    ['salary_keywords', 'Amazon,Workiva'],
  ].forEach(([k, v]) => ins.run(k, v));
}

// Ensure salary_keywords exists on existing databases (idempotent backfill)
const insertIfMissing = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertIfMissing.run('salary_keywords', 'Amazon,Workiva');
insertIfMissing.run('exclude_transfers', '1');       // 1 = exclude inter-account transfers from spending/income
insertIfMissing.run('include_rent_income', '0');     // 0 = only count salary as income, 1 = also count rent
insertIfMissing.run('rent_keywords', 'Huur,Rent');   // keywords to identify rent income

// Seed accounts if empty
const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
if (accountCount === 0) {
  const insertAccount = db.prepare('INSERT INTO accounts (name, iban, color) VALUES (?, ?, ?)');
  [
    ['Current Account', '865474001', '#3b82f6'],
    ['Savings',         '869898825', '#22c55e'],
    ['Rent Deposit',    '880287152', '#f59e0b'],
    ['Rent Income',     '867423439', '#8b5cf6'],
  ].forEach(a => insertAccount.run(...a));
}

// Backfill is_transfer for existing transactions based on IBAN match in description/counterparty.
// Idempotent — sets is_transfer=1 only for rows that aren't yet flagged.
const ibans = db.prepare('SELECT iban FROM accounts').all().map(a => a.iban.replace(/\s+/g, ''));
if (ibans.length) {
  const conds = ibans.map(i => `instr(counterparty, '${i.replace(/'/g, "''")}') > 0 OR instr(description, '${i.replace(/'/g, "''")}') > 0`).join(' OR ');
  db.exec(`UPDATE transactions SET is_transfer = 1 WHERE is_transfer = 0 AND (${conds})`);
}

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
