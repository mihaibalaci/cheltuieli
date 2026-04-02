import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Wifi, Download, Upload, Database, FileJson, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import { Toast, Modal } from '../components/UI';

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
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exportingConfig, setExportingConfig] = useState(false);
  const [importingConfig, setImportingConfig] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const dbFileRef = useRef(null);
  const configFileRef = useRef(null);

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

  async function handleBackup() {
    setBackingUp(true);
    try {
      await api.backup();
      showToast('Database backup downloaded');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestoreSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setShowRestoreConfirm(true);
    e.target.value = '';
  }

  async function handleRestoreConfirm() {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      await api.restore(restoreFile);
      showToast('Database restored. Reloading…');
      setShowRestoreConfirm(false);
      setRestoreFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setRestoring(false);
    }
  }

  async function handleExportConfig() {
    setExportingConfig(true);
    try {
      await api.exportConfig();
      showToast('Configuration exported');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setExportingConfig(false);
    }
  }

  async function handleImportConfig(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportingConfig(true);
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      const result = await api.importConfig(config);
      const { imported } = result;
      showToast(`Imported: ${imported.settings} settings, ${imported.accounts} accounts, ${imported.categories} categories, ${imported.rules} rules`);
      // Reload settings and accounts
      api.getSettings().then(setSettings);
      api.getAccounts().then(setAccounts);
    } catch (e) {
      showToast(e.message || 'Invalid configuration file', 'error');
    } finally {
      setImportingConfig(false);
    }
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
        <div style={{ marginTop: 18 }}>
          <label style={labelStyle}>Income Account Keywords</label>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            If set, only credits into the income account matching these keywords count as income (e.g. rent payments). Leave empty to count all non-transfer credits.
          </p>
          <input style={inputStyle} value={settings.income_keywords || ''}
            onChange={e => set('income_keywords', e.target.value)}
            placeholder="e.g. Huur,Rent" />
        </div>
      </Section>

      <button style={btnPrimary} onClick={handleSave} disabled={saving}>
        <Save size={14} />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Configuration Backup */}
      <div style={{ marginTop: 40, marginBottom: 8 }}>
        <h2 style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Backup & Restore
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Manage your data and configuration</p>
      </div>

      <Section
        title="Configuration"
        subtitle="Export or import your settings, accounts, categories, and auto-rules as a portable JSON file. Does not include transactions."
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={handleExportConfig} disabled={exportingConfig}>
            <FileJson size={14} />
            {exportingConfig ? 'Exporting…' : 'Export Config'}
          </button>
          <button style={{ ...btnPrimary, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
            onClick={() => configFileRef.current?.click()} disabled={importingConfig}>
            <Upload size={14} />
            {importingConfig ? 'Importing…' : 'Import Config'}
          </button>
          <input ref={configFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportConfig} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>
          Importing merges with existing data — duplicates are skipped, settings are overwritten.
        </p>
      </Section>

      <Section
        title="Full Database"
        subtitle="Download or restore the entire SQLite database file, including all transactions, users, and configuration."
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={handleBackup} disabled={backingUp}>
            <Database size={14} />
            {backingUp ? 'Downloading…' : 'Download Database'}
          </button>
          <button style={{ ...btnPrimary, background: '#ef444418', color: '#ef4444', border: '1px solid #ef444433' }}
            onClick={() => dbFileRef.current?.click()} disabled={restoring}>
            <Upload size={14} />
            {restoring ? 'Restoring…' : 'Restore Database'}
          </button>
          <input ref={dbFileRef} type="file" accept=".db,.sqlite" style={{ display: 'none' }} onChange={handleRestoreSelect} />
        </div>
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 12 }}>
          ⚠ Restoring a database replaces ALL current data and restarts the server.
        </p>
      </Section>

      {showRestoreConfirm && (
        <Modal title="Restore Database" onClose={() => { setShowRestoreConfirm(false); setRestoreFile(null); }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 8px' }}>
                This will replace your entire database with <strong>{restoreFile?.name}</strong>.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                All current transactions, categories, settings, and users will be overwritten. The server will restart after restore. This cannot be undone.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnPrimary, background: '#ef4444', color: 'white', flex: 1 }}
              onClick={handleRestoreConfirm} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Yes, restore database'}
            </button>
            <button style={{ ...btnPrimary, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => { setShowRestoreConfirm(false); setRestoreFile(null); }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
