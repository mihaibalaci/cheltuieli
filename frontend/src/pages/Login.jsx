import { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { api } from '../utils/api';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(username, password);
      localStorage.setItem('token', token);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setForgotSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setError('');
    setForgotSent(false);
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 6,
    background: 'var(--bg)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '40px 36px', width: 340,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
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

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Username</label>
              <input
                type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus required style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Password</label>
              <input
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                required style={inputStyle}
              />
            </div>
            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <button type="button" onClick={() => switchMode('forgot')} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
              }}>
                Forgot password?
              </button>
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '10px', borderRadius: 6,
              background: 'var(--accent)', border: 'none',
              color: '#0f0f0f', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
            }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <>
            {forgotSent ? (
              <div>
                <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 8 }}>Check your inbox</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                  If an account with that email exists, a reset link has been sent.
                </div>
                <button onClick={() => switchMode('login')} style={{
                  background: 'none', border: 'none', color: 'var(--accent)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                }}>
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Reset password</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                  Enter your email address and we'll send you a reset link.
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Email</label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus required style={inputStyle}
                  />
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}

                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '10px', borderRadius: 6,
                  background: 'var(--accent)', border: 'none',
                  color: '#0f0f0f', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
                }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button type="button" onClick={() => switchMode('login')} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    ← Back to sign in
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
