const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);

  const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
  const catId = cats[0].id;

  // Seed transactions across two months
  const insert = db.prepare(`
    INSERT INTO transactions (date, amount, description, counterparty, category_id, transaction_type, currency)
    VALUES (?, ?, ?, ?, ?, ?, 'EUR')
  `);
  db.transaction(() => {
    insert.run('2024-01-10', 100, 'Groceries', 'AH', catId, 'debit');
    insert.run('2024-01-15', 2000, 'Salary', 'Employer', catId, 'credit');
    insert.run('2024-02-05', 50, 'Transport', 'NS', catId, 'debit');
    insert.run('2024-02-20', 75, 'Dining', 'Restaurant', catId, 'debit');
  })();
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/reports/summary', () => {
  it('returns category breakdown', async () => {
    const res = await request(app).get('/api/reports/summary').set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.byCategory).toBeDefined();
    expect(res.body.totals).toBeDefined();
    expect(res.body.totals.total_transactions).toBe(4);
    expect(res.body.totals.total_spent).toBe(225);
    expect(res.body.totals.total_income).toBe(2000);
  });

  it('filters by month and year', async () => {
    const res = await request(app)
      .get('/api/reports/summary?month=1&year=2024')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.totals.total_transactions).toBe(2);
    expect(res.body.totals.total_spent).toBe(100);
  });

  it('filters by year only', async () => {
    const res = await request(app)
      .get('/api/reports/summary?year=2024')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.totals.total_transactions).toBe(4);
  });
});

describe('GET /api/reports/monthly-trend', () => {
  it('returns monthly aggregates', async () => {
    const res = await request(app)
      .get('/api/reports/monthly-trend?months=12')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toMatchObject({ month: expect.any(String), spent: expect.any(Number) });
  });
});

describe('GET /api/reports/available-periods', () => {
  it('returns distinct year/month periods', async () => {
    const res = await request(app)
      .get('/api/reports/available-periods')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const periods = res.body.map(p => p.period);
    expect(periods).toContain('2024-01');
    expect(periods).toContain('2024-02');
  });
});

describe('GET /api/stats/top-merchants', () => {
  it('returns top merchants by spend', async () => {
    const res = await request(app)
      .get('/api/stats/top-merchants')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ counterparty: expect.any(String), total: expect.any(Number) });
  });

  it('filters by month', async () => {
    const res = await request(app)
      .get('/api/stats/top-merchants?month=1&year=2024')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].counterparty).toBe('AH');
  });
});
