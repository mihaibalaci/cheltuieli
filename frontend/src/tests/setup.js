import '@testing-library/jest-dom';

// Polyfill ResizeObserver for jsdom (needed by Recharts)
global.ResizeObserver = class ResizeObserver {
  constructor(cb) { this.cb = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill localStorage for jsdom environments that don't support .clear()
if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
}