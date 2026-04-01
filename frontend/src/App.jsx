import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, List, Tag, Upload, Zap, TrendingDown, LogOut, Users as UsersIcon, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { api } from './utils/api';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Import from './pages/Import';
import Rules from './pages/Rules';
import UsersPage from './pages/Users';
import Reporting from './pages/Reporting';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { Loader } from './components/UI';

const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'reporting', label: 'Reporting', icon: BarChart2 },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'rules', label: 'Auto-Rules', icon: Zap },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [navFilter, setNavFilter] = useState(null);
  const inactivityTimer = useRef(null);

  // Check for password reset token in URL
  const resetToken = new URLSearchParams(window.location.search).get('reset_token');

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setAuthChecked(true); return; }
    api.me()
      .then(u => { setUser(u); setAuthChecked(true); })
      .catch(() => { localStorage.removeItem('token'); setAuthChecked(true); });
  }, []);

  // Listen for session expiry triggered in api.js
  useEffect(() => {
    function handleLogout() { setUser(null); setCategories([]); }
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const loadCategories = useCallback(() => {
    return api.getCategories().then(cats => {
      setCategories(cats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      loadCategories();
      // Refresh ECB exchange rates silently in the background
      api.refreshRates().catch(() => {});
    }
  }, [user, loadCategories]);

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setUser(null);
    setCategories([]);
  }

  // Inactivity timeout — reads session_timeout_minutes from settings
  useEffect(() => {
    if (!user) return;

    let timeoutMs = 30 * 60 * 1000; // default 30 min
    api.getSettings().then(s => {
      const mins = parseInt(s.session_timeout_minutes);
      if (mins > 0) timeoutMs = mins * 60 * 1000;
    }).catch(() => {});

    const reset = () => {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        handleLogout();
      }, timeoutMs);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer immediately

    return () => {
      clearTimeout(inactivityTimer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show reset password page if token is in URL (regardless of auth state)
  if (resetToken) {
    return <ResetPassword token={resetToken} onDone={() => { setUser(null); }} />;
  }

  if (!authChecked) return <Loader text="Loading…" />;
  if (!user) return <Login onLogin={handleLogin} />;

  function navigate(target, filters = null) {
    setNavFilter(filters);
    setPage(target);
  }

  const pages = {
    dashboard: <Dashboard onNavigate={navigate} period={navFilter?.period} />,
    transactions: <Transactions categories={categories} onRefresh={loadCategories} initialFilters={navFilter} />,
    categories: <Categories categories={categories} onRefresh={loadCategories} />,
    reporting: <Reporting />,
    import: <Import categories={categories} onRefresh={loadCategories} />,
    rules: <Rules categories={categories} />,
    users: <UsersPage currentUser={user} />,
    settings: <Settings />,
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
              <button key={id} onClick={() => { setPage(id); setNavFilter(null); }}
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

        {/* Footer: user + logout */}
        <div style={{ padding: '0 12px' }}>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, paddingLeft: 4 }}>
              {user.username} · {categories.length} categories
            </div>
            <button onClick={handleLogout} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: '1px solid transparent',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
              fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left',
            }}>
              <LogOut size={14} />
              Sign out
            </button>
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
