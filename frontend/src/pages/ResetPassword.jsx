import { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { api } from '../utils/api';

export default function ResetPassword({ token, onDone }) {
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPw !== confirmPw) return setError('Passwords do not match');
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(token, newPw);
      setSuccess(true);
      // Clear token from URL without reload
      window.history.replaceState({}, '', '/');
      setTimeout(onDone, 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
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

        {success ? (
          <div>
            <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 8 }}>Password reset!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Redirecting to login…</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Set new password</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Choose a new password for your account.
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  New password
                </label>
                <input
                  type="password" value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required minLength={6} autoFocus style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Confirm new password
                </label>
                <input
                  type="password" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>
              )}

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '10px', borderRadius: 6,
                  background: 'var(--accent)', border: 'none',
                  color: '#0f0f0f', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
                }}
              >
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
