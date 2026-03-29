const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok, categoryId;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);
  const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
  categoryId = cats[0].id;
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/rules', () => {
  it('returns seeded default rules', async () => {
    const res = await request(app).get('/api/rules').set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ keyword: expect.any(String), category_name: expect.any(String) });
  });
});

describe('POST /api/rules', () => {
  it('creates a rule', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set(auth(tok))
      .send({ keyword: 'TestShop', category_id: categoryId, priority: 5 });
    expect(res.status).toBe(200);
    expect(res.body.keyword).toBe('TestShop');
    expect(res.body.category_id).toBe(categoryId);
  });

  it('requires keyword and category_id', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set(auth(tok))
      .send({ keyword: 'NoCategory' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/rules/:id', () => {
  it('deletes a rule', async () => {
    const createRes = await request(app)
      .post('/api/rules')
      .set(auth(tok))
      .send({ keyword: 'DeleteMe', category_id: categoryId });
    const id = createRes.body.id;

    const res = await request(app)
      .delete(`/api/rules/${id}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /api/rules/apply', () => {
  it('categorizes uncategorized transactions matching a rule', async () => {
    // Insert uncategorized transaction matching a seeded rule (Albert Heijn → Groceries)
    db.prepare(`
      INSERT INTO transactions (date, amount, description, counterparty, transaction_type, currency)
      VALUES ('2024-03-01', 25.00, 'Albert Heijn betaling', 'Albert Heijn', 'debit', 'EUR')
    `).run();

    const res = await request(app)
      .post('/api/rules/apply')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);

    // Verify transaction is now categorized
    const txs = (await request(app)
      .get('/api/transactions?search=Albert')
      .set(auth(tok))).body.transactions;
    expect(txs[0].category_id).not.toBeNull();
  });
});
