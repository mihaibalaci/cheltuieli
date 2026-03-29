import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the api module's fetch wrapping behaviour: token injection,
// 401 handling, and error propagation.

describe('api utility', () => {
  let api;

  beforeEach(async () => {
    // Clear module registry so localStorage state is fresh each test
    vi.resetModules();
    localStorage.clear();
    // Re-import fresh module
    const mod = await import('../utils/api.js');
    api = mod.api;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes Authorization header when token is in localStorage', async () => {
    localStorage.setItem('token', 'test-token-abc');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([]),
    });

    await api.getCategories();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer test-token-abc');
  });

  it('does not include Authorization header when no token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([]),
    });

    await api.getCategories();

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('clears token and dispatches auth:logout on 401', async () => {
    localStorage.setItem('token', 'expired-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const logoutSpy = vi.fn();
    window.addEventListener('auth:logout', logoutSpy);

    await expect(api.getCategories()).rejects.toThrow('Session expired');
    expect(localStorage.getItem('token')).toBeNull();
    expect(logoutSpy).toHaveBeenCalledOnce();

    window.removeEventListener('auth:logout', logoutSpy);
  });

  it('throws error message from server on non-401 failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Name required' }),
    });

    await expect(api.createCategory({ color: '#fff' })).rejects.toThrow('Name required');
  });

  it('login call sends correct body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tok', user: { id: 1, username: 'admin' } }),
    });

    await api.login('admin', 'secret');

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(options.body)).toEqual({ username: 'admin', password: 'secret' });
  });
});
