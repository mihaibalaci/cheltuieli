const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const db = require('./db');
const { parseABNAMROFile } = require('./parser');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'cheltuieli-change-this-secret';
const APP_URL = process.env.APP_URL || 'http://172.16.10.26:3001';

// ===================== EMAIL =====================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendResetEmail(to, username, token) {
  const resetUrl = `${APP_URL}/?reset_token=${token}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Cheltuieli — Password Reset',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#c8f135">Cheltuieli Finance Tracker</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Someone requested a password reset for your account. Click the button below to set a new password:</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="background:#c8f135;color:#0f0f0f;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Reset my password
          </a>
        </p>
        <p style="color:#888;font-size:13px">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}

app.use(cors());
app.use(express.json());

// Seed default admin user if no users exist
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('\n⚠️  Default user created: admin / admin — please change this password!\n');
}

// ===================== AUTH =====================

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Protect all /api routes except public auth endpoints
const PUBLIC_PATHS = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];
app.use('/api', (req, res, next) => {
  if (PUBLIC_PATHS.includes(req.path)) return next();
  requireAuth(req, res, next);
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get('/api/auth/me', (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/auth/users', (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), hash);
    res.json({ id: result.lastInsertRowid, username: username.trim() });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/users', (req, res) => {
  const users = db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

app.delete('/api/auth/users/:id', (req, res) => {
  if (req.user.id === parseInt(req.params.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Update user email or reset their password (any authenticated user)
app.put('/api/auth/users/:id', (req, res) => {
  const { email, password } = req.body;
  const id = parseInt(req.params.id);
  if (password !== undefined) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
  }
  if (email !== undefined) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, id);
  }
  res.json(db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(id));
});

// Change own password (requires current password)
app.put('/api/auth/password', (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
});

// Forgot password — public (no auth required, excluded via middleware)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Always respond OK to avoid leaking whether the email exists
  if (!user) return res.json({ ok: true });
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);
  try {
    await sendResetEmail(user.email, user.username, token);
    res.json({ ok: true });
  } catch (e) {
    console.error('Email send failed:', e.message);
    res.status(500).json({ error: 'Failed to send reset email. Check SMTP configuration.' });
  }
});

// Reset password with token — public
app.post('/api/auth/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const record = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token);
  if (!record || new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Reset link is invalid or has expired' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), record.user_id);
  db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
  res.json({ ok: true });
});

// Serve React frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// File upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls', '.txt', '.mt940', '.tab'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext) || ext === '');
  }
});

// ===================== CATEGORIES =====================

app.get('/api/categories', (req, res) => {
  const cats = db.prepare(`
    SELECT c.*,
           p.name as parent_name, p.icon as parent_icon, p.color as parent_color,
           COUNT(t.id) as transaction_count,
           COALESCE(SUM(CASE WHEN t.transaction_type='debit' THEN t.amount ELSE 0 END), 0) as total_spent
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
    LEFT JOIN transactions t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY COALESCE(p.name, c.name), c.parent_id IS NULL DESC, c.name
  `).all();
  res.json(cats);
});

app.post('/api/categories', (req, res) => {
  const { name, color, icon, parent_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const result = db.prepare(
      'INSERT INTO categories (name, color, icon, parent_id) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), color || '#6366f1', icon || '📦', parent_id || null);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.json(cat);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Category already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  const { name, color, icon, parent_id } = req.body;
  const { id } = req.params;
  try {
    db.prepare(`
      UPDATE categories SET 
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        parent_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name, color, icon, parent_id || null, id);
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Name already taken' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  const other = db.prepare("SELECT id FROM categories WHERE name = 'Other'").get();
  const fallbackId = other ? other.id : null;
  
  db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(fallbackId, id);
  db.prepare('UPDATE auto_rules SET category_id = ? WHERE category_id = ?').run(fallbackId, id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ===================== TRANSACTIONS =====================

app.get('/api/transactions', (req, res) => {
  const { month, year, category_id, type, search, limit = 500, offset = 0 } = req.query;
  
  let where = [];
  let params = [];

  if (month && year) {
    where.push("strftime('%Y-%m', date) = ?");
    params.push(`${year}-${String(month).padStart(2, '0')}`);
  } else if (year) {
    where.push("strftime('%Y', date) = ?");
    params.push(year);
  }

  if (category_id) {
    where.push('t.category_id = ?');
    params.push(category_id);
  }

  if (type) {
    where.push('t.transaction_type = ?');
    params.push(type);
  }

  if (search) {
    where.push('(t.description LIKE ? OR t.counterparty LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
  
  const total = db.prepare(`SELECT COUNT(*) as c FROM transactions t ${whereStr}`).get(...params).c;
  const rows = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    ${whereStr}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({ transactions: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
});

app.put('/api/transactions/:id', (req, res) => {
  const { category_id, description, counterparty } = req.body;
  const sets = [
    'category_id = COALESCE(?, category_id)',
    'description = COALESCE(?, description)',
    'counterparty = COALESCE(?, counterparty)',
  ];
  const params = [category_id, description, counterparty];
  if ('details' in req.body) { sets.push('details = ?'); params.push(req.body.details ?? null); }
  params.push(req.params.id);
  db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(req.params.id));
});

app.put('/api/transactions/bulk/categorize', (req, res) => {
  const { ids, category_id } = req.body;
  if (!ids?.length) return res.status(400).json({ error: 'No IDs provided' });
  const stmt = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?');
  const update = db.transaction((ids) => ids.forEach(id => stmt.run(category_id, id)));
  update(ids);
  res.json({ updated: ids.length });
});

app.delete('/api/transactions/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===================== IMPORT =====================

app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const transactions = parseABNAMROFile(req.file.buffer, req.file.originalname);
    
    if (!transactions.length) {
      return res.status(400).json({ error: 'No transactions found in file. Check file format.' });
    }

    const batchId = crypto.randomUUID();
    const rules = db.prepare('SELECT keyword, category_id FROM auto_rules ORDER BY priority DESC').all();
    
    // Auto-categorize function
    function autoCategory(tx) {
      const text = `${tx.description || ''} ${tx.counterparty || ''}`.toLowerCase();
      for (const rule of rules) {
        if (text.includes(rule.keyword.toLowerCase())) return rule.category_id;
      }
      return null;
    }

    // Check for duplicates (same date + amount + description)
    const existsStmt = db.prepare(`
      SELECT id FROM transactions WHERE date = ? AND amount = ? AND description = ? LIMIT 1
    `);

    const insertStmt = db.prepare(`
      INSERT INTO transactions (date, amount, description, counterparty, category_id, account_number, currency, transaction_type, source, import_batch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)
    `);

    let inserted = 0;
    let skipped = 0;
    
    // Detect month/year from transactions
    const dates = transactions.map(t => t.date).filter(Boolean).sort();
    const firstDate = dates[0] ? new Date(dates[0]) : new Date();

    const doImport = db.transaction(() => {
      for (const tx of transactions) {
        const exists = existsStmt.get(tx.date, tx.amount, tx.description || '');
        if (exists) { skipped++; continue; }
        
        insertStmt.run(
          tx.date, tx.amount, tx.description || '', tx.counterparty || '',
          autoCategory(tx), tx.account_number || '', tx.currency || 'EUR',
          tx.transaction_type || 'debit', batchId
        );
        inserted++;
      }
    });

    doImport();

    // Record batch
    db.prepare(`
      INSERT INTO import_batches (id, filename, file_type, transaction_count, month, year)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      batchId,
      req.file.originalname,
      path.extname(req.file.originalname),
      inserted,
      firstDate.getMonth() + 1,
      firstDate.getFullYear()
    );

    res.json({ 
      batchId, 
      inserted, 
      skipped, 
      total: transactions.length,
      message: `Imported ${inserted} transactions (${skipped} duplicates skipped)`
    });

  } catch (e) {
    console.error('Import error:', e);
    res.status(500).json({ error: `Parse failed: ${e.message}` });
  }
});

app.get('/api/import/batches', (req, res) => {
  res.json(db.prepare('SELECT * FROM import_batches ORDER BY imported_at DESC').all());
});

// ===================== AUTO RULES =====================

app.get('/api/rules', (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM auto_rules r LEFT JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC, r.keyword
  `).all());
});

app.post('/api/rules', (req, res) => {
  const { keyword, category_id, match_field, priority } = req.body;
  if (!keyword || !category_id) return res.status(400).json({ error: 'keyword and category_id required' });
  const result = db.prepare(
    'INSERT INTO auto_rules (keyword, category_id, match_field, priority) VALUES (?, ?, ?, ?)'
  ).run(keyword, category_id, match_field || 'description', priority || 0);
  res.json(db.prepare('SELECT * FROM auto_rules WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/rules/:id', (req, res) => {
  const { keyword, category_id, match_field, priority } = req.body;
  if (!keyword || !category_id) return res.status(400).json({ error: 'keyword and category_id required' });
  db.prepare(`
    UPDATE auto_rules SET keyword = ?, category_id = ?, match_field = ?, priority = COALESCE(?, priority)
    WHERE id = ?
  `).run(keyword, category_id, match_field || 'description', priority ?? null, req.params.id);
  res.json(db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM auto_rules r LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.id = ?
  `).get(req.params.id));
});

app.delete('/api/rules/:id', (req, res) => {
  db.prepare('DELETE FROM auto_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Apply rules retroactively
app.post('/api/rules/apply', (req, res) => {
  const rules = db.prepare('SELECT * FROM auto_rules ORDER BY priority DESC').all();
  let updated = 0;
  const stmt = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?');
  
  const txs = db.prepare('SELECT id, description, counterparty FROM transactions WHERE category_id IS NULL').all();
  
  db.transaction(() => {
    for (const tx of txs) {
      const text = `${tx.description || ''} ${tx.counterparty || ''}`.toLowerCase();
      for (const rule of rules) {
        if (text.includes(rule.keyword.toLowerCase())) {
          stmt.run(rule.category_id, tx.id);
          updated++;
          break;
        }
      }
    }
  })();

  res.json({ updated });
});

// ===================== REPORTS =====================

// Monthly spending per category over last N months (for trend charts + insights)
app.get('/api/reports/category-trend', (req, res) => {
  const n = Math.min(parseInt(req.query.months || 12), 60);
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', t.date) as month,
      c.id, c.name, c.color, c.icon,
      SUM(CASE WHEN t.transaction_type='debit' THEN t.amount ELSE 0 END) as spent
    FROM transactions t
    INNER JOIN categories c ON t.category_id = c.id
    WHERE t.date >= date('now', '-${n} months')
    GROUP BY month, c.id
    ORDER BY month ASC
  `).all();

  const monthSet = [...new Set(rows.map(r => r.month))].sort();
  const catMap = {};
  for (const r of rows) {
    if (!catMap[r.id]) catMap[r.id] = { id: r.id, name: r.name, color: r.color, icon: r.icon, byMonth: {} };
    catMap[r.id].byMonth[r.month] = r.spent;
  }
  const categories = Object.values(catMap).map(c => ({
    id: c.id, name: c.name, color: c.color, icon: c.icon,
    monthly: monthSet.map(m => ({ month: m, spent: c.byMonth[m] || 0 })),
    total: monthSet.reduce((sum, m) => sum + (c.byMonth[m] || 0), 0),
  })).sort((a, b) => b.total - a.total);

  res.json({ months: monthSet, categories });
});

// Year-over-year comparison grouped by calendar month
app.get('/api/reports/yoy', (req, res) => {
  const rows = db.prepare(`
    SELECT
      strftime('%Y', date) as year,
      strftime('%m', date) as month,
      SUM(CASE WHEN transaction_type='debit' THEN amount ELSE 0 END) as spent,
      SUM(CASE WHEN transaction_type='credit' THEN amount ELSE 0 END) as income,
      COUNT(*) as transactions
    FROM transactions
    GROUP BY year, month
    ORDER BY year ASC, month ASC
  `).all();

  const years = [...new Set(rows.map(r => r.year))].sort();
  const byMonth = {};
  for (const r of rows) {
    if (!byMonth[r.month]) byMonth[r.month] = { month: r.month };
    byMonth[r.month][r.year + '_spent'] = r.spent;
    byMonth[r.month][r.year + '_income'] = r.income;
  }
  const allMonths = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const data = allMonths
    .filter(m => byMonth[m])
    .map(m => ({ ...byMonth[m], monthName: new Date(2000, parseInt(m) - 1).toLocaleString('en', { month: 'short' }) }));

  res.json({ years, data });
});

app.get('/api/reports/summary', (req, res) => {
  const { month, year } = req.query;
  
  let dateFilter = '';
  let params = [];
  if (month && year) {
    dateFilter = "AND strftime('%Y-%m', date) = ?";
    params = [`${year}-${String(month).padStart(2, '0')}`];
  } else if (year) {
    dateFilter = "AND strftime('%Y', date) = ?";
    params = [year];
  }

  const byCategory = db.prepare(`
    SELECT 
      c.id, c.name, c.color, c.icon,
      COUNT(t.id) as count,
      SUM(CASE WHEN t.transaction_type='debit' THEN t.amount ELSE 0 END) as spent,
      SUM(CASE WHEN t.transaction_type='credit' THEN t.amount ELSE 0 END) as income
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id ${dateFilter}
    GROUP BY c.id
    HAVING count > 0
    ORDER BY spent DESC
  `).all(...params);

  const totals = db.prepare(`
    SELECT 
      SUM(CASE WHEN transaction_type='debit' THEN amount ELSE 0 END) as total_spent,
      SUM(CASE WHEN transaction_type='credit' THEN amount ELSE 0 END) as total_income,
      COUNT(*) as total_transactions
    FROM transactions WHERE 1=1 ${dateFilter}
  `).get(...params);

  const uncategorized = db.prepare(`
    SELECT COUNT(*) as c FROM transactions WHERE category_id IS NULL ${dateFilter}
  `).get(...params).c;

  res.json({ byCategory, totals, uncategorized });
});

app.get('/api/reports/monthly-trend', (req, res) => {
  const { months = 12 } = req.query;
  const trend = db.prepare(`
    SELECT 
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN transaction_type='debit' THEN amount ELSE 0 END) as spent,
      SUM(CASE WHEN transaction_type='credit' THEN amount ELSE 0 END) as income,
      COUNT(*) as transactions
    FROM transactions
    WHERE date >= date('now', '-${parseInt(months)} months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month ASC
  `).all();
  res.json(trend);
});

app.get('/api/reports/available-periods', (req, res) => {
  const periods = db.prepare(`
    SELECT DISTINCT 
      strftime('%Y', date) as year,
      strftime('%m', date) as month,
      strftime('%Y-%m', date) as period,
      COUNT(*) as count
    FROM transactions
    GROUP BY strftime('%Y-%m', date)
    ORDER BY period DESC
  `).all();
  res.json(periods);
});

// ===================== STATS =====================

app.get('/api/stats/top-merchants', (req, res) => {
  const { month, year, limit = 10 } = req.query;
  let dateFilter = '', params = [];
  if (month && year) {
    dateFilter = "AND strftime('%Y-%m', date) = ?";
    params = [`${year}-${String(month).padStart(2, '0')}`];
  }
  const merchants = db.prepare(`
    SELECT counterparty, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE transaction_type='debit' AND counterparty != '' ${dateFilter}
    GROUP BY counterparty
    ORDER BY total DESC
    LIMIT ?
  `).all(...params, parseInt(limit));
  res.json(merchants);
});

// ===================== BACKUP & RESTORE =====================

const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.get('/api/backup', async (req, res) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/cheltuieli.db');
  const backupPath = path.join(os.tmpdir(), `cheltuieli_backup_${Date.now()}.db`);
  try {
    await db.backup(backupPath);
    const filename = `cheltuieli-backup-${new Date().toISOString().slice(0, 10)}.db`;
    res.download(backupPath, filename, () => {
      try { fs.unlinkSync(backupPath); } catch {}
    });
  } catch (e) {
    res.status(500).json({ error: 'Backup failed: ' + e.message });
  }
});

app.post('/api/restore', restoreUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/cheltuieli.db');
  const tmpPath = path.join(os.tmpdir(), `cheltuieli_restore_${Date.now()}.db`);
  try {
    fs.writeFileSync(tmpPath, req.file.buffer);
    const testDb = new Database(tmpPath, { readonly: true });
    const check = testDb.pragma('integrity_check');
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    testDb.close();
    if (check[0]?.integrity_check !== 'ok') {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Integrity check failed — not a valid SQLite database' });
    }
    const required = ['transactions', 'categories', 'users'];
    if (!required.every(t => tables.includes(t))) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Invalid backup — missing required tables' });
    }
    db.close();
    fs.copyFileSync(tmpPath, dbPath);
    try { fs.unlinkSync(tmpPath); } catch {}
    res.json({ ok: true, message: 'Database restored. Server is restarting…' });
    setTimeout(() => process.exit(1), 800);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {}
    res.status(400).json({ error: 'Restore failed: ' + e.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏦 Cheltuieli running on http://0.0.0.0:${PORT}\n`);
  });
}

module.exports = app;
