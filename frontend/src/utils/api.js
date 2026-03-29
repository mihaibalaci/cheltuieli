const BASE = '/api';

async function req(method, path, body, isForm = false) {
  const opts = {
    method,
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
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
