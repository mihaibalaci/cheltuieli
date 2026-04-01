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
  createUser: (username, password, email) => req('POST', '/auth/users', { username, password, email }),
  updateUser: (id, data) => req('PUT', `/auth/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/auth/users/${id}`),
  changePassword: (current_password, new_password) => req('PUT', '/auth/password', { current_password, new_password }),
  forgotPassword: (email) => req('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => req('POST', '/auth/reset-password', { token, new_password }),

  // Categories
  getCategories: () => req('GET', '/categories'),
  createCategory: (data) => req('POST', '/categories', data),
  updateCategory: (id, data) => req('PUT', `/categories/${id}`, data),
  deleteCategory: (id) => req('DELETE', `/categories/${id}`),

  // Transactions
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
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
  updateRule: (id, data) => req('PUT', `/rules/${id}`, data),
  deleteRule: (id) => req('DELETE', `/rules/${id}`),
  applyRules: () => req('POST', '/rules/apply'),

  // Settings
  getSettings: () => req('GET', '/settings'),
  updateSettings: (data) => req('PUT', '/settings', data),
  refreshRates: () => req('POST', '/settings/refresh-rates'),

  // Accounts
  getAccounts: () => req('GET', '/accounts'),
  createAccount: (data) => req('POST', '/accounts', data),
  updateAccount: (id, data) => req('PUT', `/accounts/${id}`, data),
  deleteAccount: (id) => req('DELETE', `/accounts/${id}`),

  // Delete month
  deleteMonth: (year, month) => req('DELETE', `/transactions/month?year=${year}&month=${month}`),
  deleteRange: (from, to) => req('DELETE', `/transactions/range?from=${from}&to=${to}`),
  countTransactions: (from, to) => req('GET', `/transactions/count?from=${from}&to=${to}`),

  // Backup & Restore
  backup: async () => {
    const token = getToken();
    const res = await fetch(BASE + '/backup', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Backup failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cheltuieli-backup-${new Date().toISOString().slice(0, 10)}.db`;
    a.click();
    URL.revokeObjectURL(url);
  },
  restore: (file) => {
    const form = new FormData();
    form.append('file', file);
    return req('POST', '/restore', form, true);
  },

  // Reports
  getSummary: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v));
    return req('GET', `/reports/summary?${qs}`);
  },
  getMonthlyTrend: (months = 12) => req('GET', `/reports/monthly-trend?months=${months}`),
  getCategoryTrend: (months = 12) => req('GET', `/reports/category-trend?months=${months}`),
  getYoY: () => req('GET', '/reports/yoy'),
  getPeriods: () => req('GET', '/reports/available-periods'),
  getTopMerchants: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v));
    return req('GET', `/stats/top-merchants?${qs}`);
  },
  getAccountBalances: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v));
    return req('GET', `/reports/account-balances?${qs}`);
  },
};
