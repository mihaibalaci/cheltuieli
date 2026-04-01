const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/accounts', () => {
  it('returns seeded default accounts', async () => {
    const res = await request(app).get('/api/accounts').set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
    expect(res.body[0]).toMatchObject({ name: expect.any(String), iban: expect.any(String), color: expect.any(String) });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/accounts', () => {
  it('creates an account', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(auth(tok))
      .send({ name: 'Test Account', iban: 'NL00TEST0001', color: '#ff0000' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Account');
    expect(res.body.iban).toBe('NL00TEST0001');
    expect(res.body.id).toBeDefined();
  });

  it('normalizes IBAN by stripping spaces', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(auth(tok))
      .send({ name: 'Spaced IBAN', iban: 'NL00 TEST 0002', color: '#00ff00' });
    expect(res.status).toBe(200);
    expect(res.body.iban).toBe('NL00TEST0002');
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(auth(tok))
      .send({ iban: 'NL00TEST9999' });
    expect(res.status).toBe(400);
  });

  it('rejects missing IBAN', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(auth(tok))
      .send({ name: 'No IBAN' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate IBAN', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(auth(tok))
      .send({ name: 'Dup Account', iban: 'NL00TEST0001' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe('PUT /api/accounts/:id', () => {
  let accountId;

  beforeAll(async () => {
    const accounts = (await request(app).get('/api/accounts').set(auth(tok))).body;
    accountId = accounts.find(a => a.name === 'Test Account').id;
  });

  it('updates account name and color', async () => {
    const res = await request(app)
      .put(`/api/accounts/${accountId}`)
      .set(auth(tok))
      .send({ name: 'Renamed Account', color: '#0000ff' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Account');
    expect(res.body.color).toBe('#0000ff');
  });

  it('updates IBAN', async () => {
    const res = await request(app)
      .put(`/api/accounts/${accountId}`)
      .set(auth(tok))
      .send({ iban: 'NL00UPDATED01' });
    expect(res.status).toBe(200);
    expect(res.body.iban).toBe('NL00UPDATED01');
  });
});

describe('DELETE /api/accounts/:id', () => {
  it('deletes an account and unlinks transactions', async () => {
    // Create account and a transaction linked to it
    const accRes = await request(app)
      .post('/api/accounts')
      .set(auth(tok))
      .send({ name: 'Deletable', iban: 'NL00DELETE01' });
    const accId = accRes.body.id;

    db.prepare(`
      INSERT INTO transactions (date, amount, description, transaction_type, currency, account_id)
      VALUES ('2024-06-01', 10, 'Test tx', 'debit', 'EUR', ?)
    `).run(accId);

    const res = await request(app)
      .delete(`/api/accounts/${accId}`)
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify transaction account_id is now NULL
    const tx = db.prepare('SELECT account_id FROM transactions WHERE description = ?').get('Test tx');
    expect(tx.account_id).toBeNull();
  });
});
