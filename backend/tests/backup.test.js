const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/backup', () => {
  it('downloads a valid SQLite backup file', async () => {
    const res = await request(app)
      .get('/api/backup')
      .set(auth(tok));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/cheltuieli-backup.*\.db/);
    expect(res.body).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/backup');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/restore', () => {
  it('rejects request without file', async () => {
    const res = await request(app)
      .post('/api/restore')
      .set(auth(tok));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('rejects invalid (non-SQLite) file', async () => {
    const res = await request(app)
      .post('/api/restore')
      .set(auth(tok))
      .attach('file', Buffer.from('not a database'), 'fake.db');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/integrity|failed|valid/i);
  });
});
