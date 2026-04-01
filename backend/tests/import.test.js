const request = require('supertest');
const path = require('path');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);
});

afterAll(() => cleanup({ db, dbPath }));

describe('POST /api/import', () => {
  it('rejects request without file', async () => {
    const res = await request(app)
      .post('/api/import')
      .set(auth(tok));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('imports a CSV tab-delimited file', async () => {
    const csvContent = [
      '865474001\tEUR\t20240315\t1000.00\t950.00\t20240315\t-50.00\tAlbert Heijn betaling',
      '865474001\tEUR\t20240316\t950.00\t2950.00\t20240316\t2000.00\tSalaris Employer BV',
    ].join('\n');

    const res = await request(app)
      .post('/api/import')
      .set(auth(tok))
      .attach('file', Buffer.from(csvContent), 'export.csv');
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(res.body.batchId).toBeDefined();
  });

  it('skips duplicate transactions on re-import', async () => {
    const csvContent = [
      '865474001\tEUR\t20240315\t1000.00\t950.00\t20240315\t-50.00\tAlbert Heijn betaling',
    ].join('\n');

    const res = await request(app)
      .post('/api/import')
      .set(auth(tok))
      .attach('file', Buffer.from(csvContent), 'export2.csv');
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('auto-categorizes using existing rules', async () => {
    // "Albert Heijn" rule is seeded by default → Groceries
    const txs = (await request(app)
      .get('/api/transactions?search=Albert%20Heijn%20betaling')
      .set(auth(tok))).body.transactions;
    const matched = txs.find(t => t.description.includes('Albert Heijn betaling'));
    expect(matched).toBeDefined();
    expect(matched.category_id).not.toBeNull();
  });
});

describe('GET /api/import/batches', () => {
  it('returns import history', async () => {
    const res = await request(app)
      .get('/api/import/batches')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toMatchObject({
      filename: expect.any(String),
      transaction_count: expect.any(Number),
    });
  });
});
