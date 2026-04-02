const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok, categoryId;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);

  // Get a real category id
  const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
  categoryId = cats[0].id;

  // Seed a few transactions directly
  const insert = db.prepare(`
    INSERT INTO transactions (date, amount, description, counterparty, category_id, transaction_type, currency)
    VALUES (?, ?, ?, ?, ?, ?, 'EUR')
  `);
  db.transaction(() => {
    insert.run('2024-01-15', 42.50, 'Albert Heijn groceries', 'Albert Heijn', categoryId, 'debit');
    insert.run('2024-01-20', 1200.00, 'Salary payment', 'Employer BV', categoryId, 'credit');
    insert.run('2024-02-05', 9.99, 'Spotify subscription', 'Spotify', null, 'debit');
    insert.run('2024-02-10', 55.00, 'NS train ticket', 'NS', categoryId, 'debit');
  })();
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/transactions', () => {
  it('returns all transactions', async () => {
    const res = await request(app).get('/api/transactions').set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBe(4);
    expect(res.body.total).toBe(4);
  });

  it('filters by month and year', async () => {
    const res = await request(app)
      .get('/api/transactions?month=1&year=2024')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBe(2);
  });

  it('filters by type', async () => {
    const res = await request(app)
      .get('/api/transactions?type=credit')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.every(t => t.transaction_type === 'credit')).toBe(true);
  });

  it('filters by search term', async () => {
    const res = await request(app)
      .get('/api/transactions?search=spotify')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBe(1);
    expect(res.body.transactions[0].description).toMatch(/spotify/i);
  });

  it('filters by category', async () => {
    const res = await request(app)
      .get(`/api/transactions?category_id=${categoryId}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.every(t => t.category_id === categoryId)).toBe(true);
  });

  it('respects pagination', async () => {
    const res = await request(app)
      .get('/api/transactions?limit=2&offset=0')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBe(2);
    expect(res.body.total).toBe(4);
  });

  it('sorts by date ascending', async () => {
    const res = await request(app)
      .get('/api/transactions?sort=asc')
      .set(auth(tok));
    expect(res.status).toBe(200);
    const dates = res.body.transactions.map(t => t.date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true);
    }
  });

  it('sorts by date descending by default', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set(auth(tok));
    expect(res.status).toBe(200);
    const dates = res.body.transactions.map(t => t.date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] <= dates[i - 1]).toBe(true);
    }
  });
});

describe('PUT /api/transactions/:id', () => {
  let txId;

  beforeAll(async () => {
    const res = await request(app).get('/api/transactions').set(auth(tok));
    txId = res.body.transactions[0].id;
  });

  it('updates category', async () => {
    const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
    const newCat = cats[1];
    const res = await request(app)
      .put(`/api/transactions/${txId}`)
      .set(auth(tok))
      .send({ category_id: newCat.id });
    expect(res.status).toBe(200);
    expect(res.body.category_id).toBe(newCat.id);
  });

  it('updates description', async () => {
    const res = await request(app)
      .put(`/api/transactions/${txId}`)
      .set(auth(tok))
      .send({ description: 'Updated description' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated description');
  });
});

describe('PUT /api/transactions/bulk/categorize', () => {
  it('bulk updates category for multiple transactions', async () => {
    const txs = (await request(app).get('/api/transactions').set(auth(tok))).body.transactions;
    const ids = txs.slice(0, 2).map(t => t.id);
    const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
    const targetCat = cats[2];

    const res = await request(app)
      .put('/api/transactions/bulk/categorize')
      .set(auth(tok))
      .send({ ids, category_id: targetCat.id });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
  });

  it('returns 400 with no IDs', async () => {
    const res = await request(app)
      .put('/api/transactions/bulk/categorize')
      .set(auth(tok))
      .send({ ids: [], category_id: 1 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('deletes a transaction', async () => {
    const txs = (await request(app).get('/api/transactions').set(auth(tok))).body.transactions;
    const id = txs[txs.length - 1].id;

    const res = await request(app)
      .delete(`/api/transactions/${id}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const after = (await request(app).get('/api/transactions').set(auth(tok))).body;
    expect(after.total).toBe(3);
  });
});
