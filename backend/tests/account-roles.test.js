const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;
let spendingAccId, incomeAccId, otherAccId;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);

  // Get seeded accounts
  const accounts = (await request(app).get('/api/accounts').set(auth(tok))).body;
  // Use first two as spending/income, third as "other"
  spendingAccId = accounts[0].id;
  incomeAccId = accounts[1].id;
  otherAccId = accounts[2].id;

  // Configure account roles
  await request(app).put('/api/settings').set(auth(tok)).send({
    spending_account_id: String(spendingAccId),
    income_account_id: String(incomeAccId),
    salary_keywords: 'Amazon,Workiva',
  });

  // Get a category
  const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
  const catId = cats[0].id;

  // Seed transactions across accounts
  const insert = db.prepare(`
    INSERT INTO transactions (date, amount, description, counterparty, category_id, transaction_type, currency, account_id)
    VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?)
  `);
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10);

  db.transaction(() => {
    // Spending account debits (should count as spending)
    insert.run(thisMonth, 100, 'Groceries', 'AH', catId, 'debit', spendingAccId);
    insert.run(thisMonth, 50, 'Transport', 'NS', catId, 'debit', spendingAccId);
    // Spending account salary credit (should count as income)
    insert.run(thisMonth, 3000, 'Salary', 'Amazon NL', catId, 'credit', spendingAccId);
    // Spending account non-salary credit (should NOT count as income)
    insert.run(thisMonth, 500, 'Transfer from savings', 'Own transfer', catId, 'credit', spendingAccId);
    // Income account credit (should count as income)
    insert.run(thisMonth, 800, 'Rent payment', 'Tenant', catId, 'credit', incomeAccId);
    // Other account debit (should NOT count as spending)
    insert.run(thisMonth, 200, 'Deposit fee', 'Bank', catId, 'debit', otherAccId);
    // Other account credit (should NOT count as income)
    insert.run(thisMonth, 100, 'Interest', 'Bank', catId, 'credit', otherAccId);
  })();
});

afterAll(() => cleanup({ db, dbPath }));

describe('Account-aware summary', () => {
  it('only counts spending account debits as total_spent', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    expect(res.status).toBe(200);
    // 100 + 50 = 150 (only spending account debits)
    expect(res.body.totals.total_spent).toBe(150);
  });

  it('counts income account credits + salary credits as total_income', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    expect(res.status).toBe(200);
    // 3000 (Amazon salary) + 800 (rent) = 3800
    // The 500 transfer and 100 interest should NOT count
    expect(res.body.totals.total_income).toBe(3800);
  });
});

describe('Account-aware monthly trend', () => {
  it('uses account roles for spent/income in trend', async () => {
    const res = await request(app)
      .get('/api/reports/monthly-trend?months=2')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const month = res.body[res.body.length - 1];
    expect(month.spent).toBe(150);
    expect(month.income).toBe(3800);
  });
});

describe('Account-aware top merchants', () => {
  it('only includes spending account merchants', async () => {
    const res = await request(app)
      .get('/api/stats/top-merchants')
      .set(auth(tok));
    expect(res.status).toBe(200);
    const names = res.body.map(m => m.counterparty);
    // AH and NS are from spending account
    expect(names).toContain('AH');
    expect(names).toContain('NS');
    // Bank is from other account — should be excluded
    expect(names).not.toContain('Bank');
  });
});

describe('Account balances endpoint', () => {
  it('returns per-account balances and total', async () => {
    const res = await request(app)
      .get('/api/reports/account-balances')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.accounts)).toBe(true);
    expect(res.body.total).toBeDefined();
    expect(typeof res.body.total).toBe('number');

    // Each account should have balance fields
    const acc = res.body.accounts.find(a => a.id === spendingAccId);
    expect(acc).toBeDefined();
    expect(acc.total_in).toBeDefined();
    expect(acc.total_out).toBeDefined();
    expect(acc.balance).toBeDefined();
    expect(acc.transactions).toBeGreaterThan(0);
  });

  it('spending account balance = credits - debits', async () => {
    const res = await request(app)
      .get('/api/reports/account-balances')
      .set(auth(tok));
    const acc = res.body.accounts.find(a => a.id === spendingAccId);
    // Credits: 3000 + 500 = 3500, Debits: 100 + 50 = 150, Balance: 3350
    expect(acc.total_in).toBe(3500);
    expect(acc.total_out).toBe(150);
    expect(acc.balance).toBe(3350);
  });
});

describe('Uncategorized filter', () => {
  beforeAll(() => {
    // Insert an uncategorized transaction
    db.prepare(`
      INSERT INTO transactions (date, amount, description, transaction_type, currency, account_id)
      VALUES ('2024-06-01', 15, 'Unknown shop', 'debit', 'EUR', ?)
    `).run(spendingAccId);
  });

  it('filters transactions by category_id=none', async () => {
    const res = await request(app)
      .get('/api/transactions?category_id=none')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.transactions.every(t => t.category_id === null)).toBe(true);
  });
});
