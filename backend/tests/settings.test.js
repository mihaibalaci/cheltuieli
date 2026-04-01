const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/settings', () => {
  it('returns seeded default settings', async () => {
    const res = await request(app).get('/api/settings').set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.body.session_timeout_minutes).toBe('30');
    expect(res.body.default_currency).toBe('EUR');
    expect(res.body.fx_EUR).toBe('1.0000');
    expect(res.body.fx_RON).toBeDefined();
    expect(res.body.fx_USD).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/settings', () => {
  it('updates existing settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(auth(tok))
      .send({ session_timeout_minutes: '60' });
    expect(res.status).toBe(200);
    expect(res.body.session_timeout_minutes).toBe('60');
  });

  it('creates new settings keys', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(auth(tok))
      .send({ custom_key: 'custom_value' });
    expect(res.status).toBe(200);
    expect(res.body.custom_key).toBe('custom_value');
  });

  it('updates multiple settings at once', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(auth(tok))
      .send({ default_currency: 'RON', session_timeout_minutes: '15' });
    expect(res.status).toBe(200);
    expect(res.body.default_currency).toBe('RON');
    expect(res.body.session_timeout_minutes).toBe('15');
  });
});

describe('Account role settings', () => {
  it('stores spending_account_id and income_account_id', async () => {
    const accounts = (await request(app).get('/api/accounts').set(auth(tok))).body;
    const spendingId = accounts[0].id;
    const incomeId = accounts[1].id;

    const res = await request(app)
      .put('/api/settings')
      .set(auth(tok))
      .send({
        spending_account_id: String(spendingId),
        income_account_id: String(incomeId),
        salary_keywords: 'Amazon,Workiva',
      });
    expect(res.status).toBe(200);
    expect(res.body.spending_account_id).toBe(String(spendingId));
    expect(res.body.income_account_id).toBe(String(incomeId));
    expect(res.body.salary_keywords).toBe('Amazon,Workiva');
  });
});
