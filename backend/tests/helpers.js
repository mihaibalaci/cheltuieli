const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

/**
 * Creates a fresh app + db instance with an isolated temp SQLite file.
 * Call this inside beforeAll() — must run AFTER jest.resetModules().
 */
function createApp() {
  const dbPath = path.join(os.tmpdir(), `cheltuieli_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
  process.env.DB_PATH = dbPath;
  process.env.NODE_ENV = 'test';
  jest.resetModules();
  const app = require('../server');
  const db = require('../db');
  return { app, db, dbPath };
}

function cleanup({ db, dbPath }) {
  try { db.close(); } catch {}
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  try { fs.unlinkSync(dbPath + '-shm'); } catch {}
}

async function login(app, username = 'admin', password = 'admin') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  return res.body.token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createApp, cleanup, login, auth };
