import { useState, useEffect } from 'react';
import { Save, RefreshCw, Wifi } from 'lucide-react';
import { api } from '../utils/api';
import { Toast } from '../components/UI';

const TIMEOUT_OPTIONS = [
  { label: '5 minutes',  value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour',     value: 60 },
  { label: '2 hours',    value: 120 },
  { label: 'Never',      value: 0 },
];

const CURRENCIES = ['EUR', 'RON', 'USD'];

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, marginBottom: 24, overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 6,
  background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
  fontFamily: 'inherit', outline: 'none',
};
const btnPrimary = {
  padding: '8px 18px', borderRadius: 6, border: 'none',
  background: 'var(--accent)', color: '#0f0f0f', fontSize: 13,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: 7,
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => showToast('Failed to load settings', 'error'));
    api.getAccounts().then(setAccounts).catch(() => {});
  }, []);

  async function handleRefreshRates() {
    setRefreshing(true);
    try {
      await api.refreshRates();
      const updated = await api.getSettings();
      setSettings(updated);
      showToast('Exchange rates updated from ECB');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showToast('Settings saved');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function set(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  if (!settings) {
    return (
      <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading settings…
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 640, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Application preferences</p>
      </div>

      {/* Session */}
      <Section
        title="Session Timeout"
        subtitle="Automatically sign you out after a period of inactivity."
      >
        <label style={labelStyle}>Timeout after</label>
        <select style={inputStyle} value={settings.session_timeout_minutes}
          onChange={e => set('session_timeout_minutes', e.target.value)}>
          {TIMEOUT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {settings.session_timeout_minutes == 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            Session will never expire automatically.
          </p>
        )}
      </Section>

      {/* Currency */}
      <Section
        title="Currency"
        subtitle="Set your primary currency. Transactions in other currencies are converted to this for all reports."
      >
        <label style={labelStyle}>Default currency</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => set('default_currency', c)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
              border: settings.default_currency === c ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: settings.default_currency === c ? 'var(--accent)18' : 'var(--bg)',
              color: settings.default_currency === c ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'DM Mono', fontSize: 15, fontWeight: 600,
            }}>
              {c}
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              Exchange rates to {settings.default_currency}
            </div>
            <button
              onClick={handleRefreshRates}
              disabled={refreshing}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'inherit',
              }}
            >
              <Wifi size={12} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
              {refreshing ? 'Fetching…' : 'Refresh from ECB'}
            </button>
          </div>
          {settings.fx_updated_at && (
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
              Last updated: {new Date(settings.fx_updated_at).toLocaleString()}
            </p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Rates are fetched automatically from the European Central Bank on every login. You can also update them manually.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CURRENCIES.filter(c => c !== settings.default_currency).map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text)', width: 40 }}>{c}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>1 {c} =</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  style={{ ...inputStyle, width: 120 }}
                  value={settings[`fx_${c}`] ?? ''}
                  onChange={e => set(`fx_${c}`, e.target.value)}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{settings.default_currency}</span>
              </div>
            ))}
            {/* Always keep EUR rate for conversion base */}
            {settings.default_currency !== 'EUR' && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                EUR rate is also used internally as the base conversion reference.
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Account Roles */}
      <Section
        title="Account Roles"
        subtitle="Configure which accounts count toward Income and Spending in reports."
      >
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Spending Account</label>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            Only debits from this account count toward Total Spent.
          </p>
          <select style={inputStyle} value={settings.spending_account_id || ''}
            onChange={e => set('spending_account_id', e.target.value)}>
            <option value="">Not set (all accounts)</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.iban}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Income Account</label>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            All credits into this account count as Income (e.g. rent collection).
          </p>
          <select style={inputStyle} value={settings.income_account_id || ''}
            onChange={e => set('income_account_id', e.target.value)}>
            <option value="">Not set (all accounts)</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.iban}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Salary Keywords</label>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            Credits into the spending account from counterparties matching these keywords also count as Income. Comma-separated.
          </p>
          <input style={inputStyle} value={settings.salary_keywords || ''}
            onChange={e => set('salary_keywords', e.target.value)}
            placeholder="e.g. Amazon,Workiva" />
        </div>
      </Section>

      <button style={btnPrimary} onClick={handleSave} disabled={saving}>
        <Save size={14} />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}
