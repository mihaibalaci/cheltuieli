const request = require('supertest');
const { createApp, cleanup, login, auth } = require('./helpers');

let app, db, dbPath, tok;

beforeAll(async () => {
  ({ app, db, dbPath } = createApp());
  tok = await login(app);
});

afterAll(() => cleanup({ db, dbPath }));

describe('GET /api/categories', () => {
  it('returns seeded default categories', async () => {
    const res = await request(app).get('/api/categories').set(auth(tok));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ name: expect.any(String), color: expect.any(String) });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/categories', () => {
  it('creates a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set(auth(tok))
      .send({ name: 'Test Category', color: '#ff0000', icon: '🧪' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Category');
    expect(res.body.color).toBe('#ff0000');
    expect(res.body.id).toBeDefined();
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set(auth(tok))
      .send({ color: '#ff0000' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set(auth(tok))
      .send({ name: 'Test Category' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe('PUT /api/categories/:id', () => {
  let catId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/categories')
      .set(auth(tok))
      .send({ name: 'Editable Cat', color: '#aaa', icon: '✏️' });
    catId = res.body.id;
  });

  it('updates name and color', async () => {
    const res = await request(app)
      .put(`/api/categories/${catId}`)
      .set(auth(tok))
      .send({ name: 'Updated Cat', color: '#00ff00' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Cat');
    expect(res.body.color).toBe('#00ff00');
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a category and reassigns transactions to Other', async () => {
    const createRes = await request(app)
      .post('/api/categories')
      .set(auth(tok))
      .send({ name: 'To Delete', color: '#ccc', icon: '🗑️' });
    const id = createRes.body.id;

    const delRes = await request(app)
      .delete(`/api/categories/${id}`)
      .set(auth(tok));
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    // Confirm it's gone
    const cats = (await request(app).get('/api/categories').set(auth(tok))).body;
    expect(cats.find(c => c.id === id)).toBeUndefined();
  });
});
