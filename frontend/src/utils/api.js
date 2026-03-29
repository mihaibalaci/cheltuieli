const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function req(method, path, body, isForm = false) {
  const token = getToken();
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(BASE + path, opts);
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  me: () => req('GET', '/auth/me'),
  getUsers: () => req('GET', '/auth/users'),
  createUser: (username, password) => req('POST', '/auth/users', { username, password }),
  deleteUser: (id) => req('DELETE', `/auth/users/${id}`),

  // Categories
  getCategories: () => req('GET', '/categories'),
  createCategory: (data) => req('POST', '/categories', data),
  updateCategory: (id, data) => req('PUT', `/categories/${id}`, data),
  deleteCategory: (id) => req('DELETE', `/categories/${id}`),

  // Transactions
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v != null && v !== ''));
    return req('GET', `/transactions?${qs}`);
  },
  updateTransaction: (id, data) => req('PUT', `/transactions/${id}`, data),
  bulkCategorize: (ids, category_id) => req('PUT', '/transactions/bulk/categorize', { ids, category_id }),
  deleteTransaction: (id) => req('DELETE', `/transactions/${id}`),

  // Import
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return req('POST', '/import', form, true);
  },
  getBatches: () => req('GET', '/import/batches'),

  // Rules
  getRules: () => req('GET', '/rules'),
  createRule: (data) => req('POST', '/rules', data),
  deleteRule: (id) => req('DELETE', `/rules/${id}`),
  applyRules: () => req('POST', '/rules/apply'),

  // Reports
  getSummary: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v));
    return req('GET', `/reports/summary?${qs}`);
  },
  getMonthlyTrend: (months = 12) => req('GET', `/reports/monthly-trend?months=${months}`),
  getPeriods: () => req('GET', '/reports/available-periods'),
  getTopMerchants: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v));
    return req('GET', `/stats/top-merchants?${qs}`);
  },
};
