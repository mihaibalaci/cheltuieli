const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);

  const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
  const catId = cats[0].id;

  // Seed transactions across two recent months (within last 12 months for trend query)
  const now = new Date();
  const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString().slice(0, 10);
  const m1b = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 10);
  const m2 = new Date(now.getFullYear(), now.getMonth(), 5).toISOString().slice(0, 10);
  const m2b = new Date(now.getFullYear(), now.getMonth(), 20).toISOString().slice(0, 10);

  const insert = db.prepare(`
    INSERT INTO transactions (date, amount, description, counterparty, category_id, transaction_type, currency)
    VALUES (?, ?, ?, ?, ?, ?, 'EUR')
  `);
  db.transaction(() => {
    insert.run(m1,  100,  'Groceries', 'AH',          catId, 'debit');
    insert.run(m1b, 2000, 'Salary',    'Employer',     catId, 'credit');
    insert.run(m2,  50,   'Transport', 'NS',            catId, 'debit');
    insert.run(m2b, 75,   'Dining',    'Restaurant',    catId, 'debit');
  })();

  // Configure salary keywords so "Employer" credits count as income
  await request(app).put('/api/settings').set(auth(tok)).send({
    salary_keywords: 'Employer',
  });

  // Also store fixed month/year for filter tests
  Object.assign(global, {
    testMonth1: String(now.getMonth()).padStart(2, '0') === '00' ? '12' : String(now.getMonth()).padStart(2, '0'),
    testYear1: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
  });
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
    const now = new Date();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const res = await request(app)
      .get(`/api/reports/summary?month=${month}&year=${year}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.totals.total_transactions).toBe(2);
  });

  it('filters by year only', async () => {
    const year = new Date().getFullYear();
    const res = await request(app)
      .get(`/api/reports/summary?year=${year}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.totals.total_transactions).toBeGreaterThanOrEqual(2);
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
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toMatchObject({ year: expect.any(String), month: expect.any(String), count: expect.any(Number) });
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
    const now = new Date();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const res = await request(app)
      .get(`/api/stats/top-merchants?month=${month}&year=${year}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    // Previous month has AH and Employer (debit only = AH)
    expect(res.body.length).toBe(1);
    expect(res.body[0].counterparty).toBe('AH');
  });
});
