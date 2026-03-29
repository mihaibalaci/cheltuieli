import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, List, Tag, Upload, Zap, TrendingDown } from 'lucide-react';
import { api } from './utils/api';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Import from './pages/Import';
import Rules from './pages/Rules';
import { Loader } from './components/UI';

const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'rules', label: 'Auto-Rules', icon: Zap },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(() => {
    return api.getCategories().then(cats => {
      setCategories(cats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const pages = {
    dashboard: <Dashboard />,
    transactions: <Transactions categories={categories} onRefresh={loadCategories} />,
    categories: <Categories categories={categories} onRefresh={loadCategories} />,
    import: <Import categories={categories} onRefresh={loadCategories} />,
    rules: <Rules categories={categories} />,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '0 0 20px'
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingDown size={18} color="#0f0f0f" />
            </div>
            <div>
              <div style={{ fontFamily: 'Playfair Display', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Cheltuieli
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>FINANCE TRACKER</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ padding: '16px 12px', flex: 1 }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => setPage(id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                  background: active ? 'var(--accent)18' : 'transparent',
                  border: active ? '1px solid var(--accent)33' : '1px solid transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 13, fontWeight: active ? 500 : 400,
                  fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left',
                }}>
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Category count */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            {categories.length} categories · ABN AMRO
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? <Loader text="Loading..." /> : pages[page]}
      </main>
    </div>
  );
}
