const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;
let spendingAccId, incomeAccId, otherAccId;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);

  // Get seeded accounts (IBANs: 865474001, 869898825, 880287152, 867423439)
  const accounts = (await request(app).get('/api/accounts').set(auth(tok))).body;
  // Use first two as spending/income, third as "other"
  spendingAccId = accounts[0].id;
  incomeAccId = accounts[1].id;
  otherAccId = accounts[2].id;
  // Store IBANs for transfer tests
  const spendingIban = accounts[0].iban;
  const savingsIban = accounts[1].iban;

  // Configure account roles — only spending account matters for income/spending
  await request(app).put('/api/settings').set(auth(tok)).send({
    spending_account_id: String(spendingAccId),
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

    // Inter-account transfers (should be EXCLUDED from both income and spending)
    // Transfer from spending to savings: debit on spending account, counterparty contains savings IBAN
    insert.run(thisMonth, 300, 'Transfer to savings ' + savingsIban, savingsIban, catId, 'debit', spendingAccId);
    // Transfer from savings to spending: credit on income account, counterparty contains spending IBAN
    insert.run(thisMonth, 150, 'Transfer from current ' + spendingIban, spendingIban, catId, 'credit', incomeAccId);
  })();

  // Backfill is_transfer flag (mirrors what db.js does on startup)
  const ibans = db.prepare('SELECT iban FROM accounts').all().map(a => a.iban.replace(/\s+/g, ''));
  const conds = ibans.map(i => `instr(counterparty, '${i}') > 0 OR instr(description, '${i}') > 0`).join(' OR ');
  db.exec(`UPDATE transactions SET is_transfer = 1 WHERE is_transfer = 0 AND (${conds})`);
});

afterAll(() => cleanup({ db, dbPath }));

describe('Account-aware summary', () => {
  it('only counts spending account debits as total_spent, excluding inter-account transfers', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    expect(res.status).toBe(200);
    // 100 + 50 = 150 (only spending account debits, 300 transfer to savings excluded)
    expect(res.body.totals.total_spent).toBe(150);
  });

  it('counts only salary credits on spending account as total_income', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    expect(res.status).toBe(200);
    // Only 3000 (Amazon salary on spending account) counts as income
    // 800 rent, 500 transfer, 100 interest, 150 inter-account transfer all excluded
    expect(res.body.totals.total_income).toBe(3000);
  });
});

describe('Account-aware monthly trend', () => {
  it('uses account roles for spent/income in trend, excluding inter-account transfers', async () => {
    const res = await request(app)
      .get('/api/reports/monthly-trend?months=2')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const month = res.body[res.body.length - 1];
    // 100 + 50 = 150 (300 transfer excluded)
    expect(month.spent).toBe(150);
    // Only 3000 salary (rent excluded from income)
    expect(month.income).toBe(3000);
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
    // Credits: 3000 + 500 = 3500, Debits: 100 + 50 + 300 = 450, Balance: 3050
    expect(acc.total_in).toBe(3500);
    expect(acc.total_out).toBe(450);
    expect(acc.balance).toBe(3050);
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

describe('Inter-account transfer exclusion', () => {
  it('excludes transfers to own accounts from spending', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    // The 300 debit to savings IBAN should NOT be counted as spending
    // Only 100 (AH) + 50 (NS) = 150
    expect(res.body.totals.total_spent).toBe(150);
  });

  it('excludes transfers from own accounts from income', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    // Income = salary only (3000). Rent (800), transfers (150), interest (100) all excluded.
    expect(res.body.totals.total_income).toBe(3000);
  });

  it('still includes transfers in account balances (raw in/out)', async () => {
    const res = await request(app).get('/api/reports/account-balances').set(auth(tok));
    const spending = res.body.accounts.find(a => a.id === spendingAccId);
    // Spending account: credits 3000+500 = 3500, debits 100+50+300 = 450
    expect(spending.total_in).toBe(3500);
    expect(spending.total_out).toBe(450);
  });
});
