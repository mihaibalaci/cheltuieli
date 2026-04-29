import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { api } from '../utils/api';
import { Toast, Loader } from '../components/UI';

export default function Import({ categories, onRefresh }) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [batches, setBatches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [toast, setToast] = useState(null);
  const [applyingRules, setApplyingRules] = useState(false);
  const inputRef = useRef();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.getBatches().then(setBatches);
    api.getAccounts().then(setAccounts);
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await api.importFile(file, selectedAccount || null);
      setResult({ ...res, filename: file.name, ok: true });
      showToast(res.message, 'success');
      api.getBatches().then(setBatches);
      onRefresh();
    } catch (e) {
      setResult({ error: e.message, ok: false });
      showToast(e.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const applyRules = async () => {
    setApplyingRules(true);
    try {
      const res = await api.applyRules();
      showToast(`Applied rules: ${res.updated} transactions categorized`);
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setApplyingRules(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Import Transactions
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Upload ABN AMRO exports: CSV, Excel (.xlsx), or MT940 format
        </p>
      </div>

      {/* Account selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Assign transactions to account
        </label>
        <select
          className="input"
          style={{ width: '100%' }}
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          disabled={importing}
        >
          <option value="">Auto-detect from file (IBAN matching)</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name} — {a.iban}</option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, marginBottom: 0 }}>
          If your export file doesn't include account numbers or IBAN matching fails, select the target account here to override detection.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${dragging ? 'active' : ''}`}
        style={{ marginBottom: 20 }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.txt,.mt940,.tab" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        
        {importing ? (
          <div>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Processing file...</p>
          </div>
        ) : (
          <div>
            <Upload size={32} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              Drop your ABN AMRO export here
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Supports: CSV (tab-delimited) · Excel (.xlsx) · MT940 · Click to browse
            </p>
          </div>
        )}
      </div>

      {/* Import result */}
      {result && (
        <div className="card animate-fade-up" style={{ marginBottom: 20, borderColor: result.ok ? 'var(--green)44' : 'var(--red)44' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: result.ok ? 12 : 0 }}>
            {result.ok
              ? <CheckCircle size={18} color="var(--green)" />
              : <AlertCircle size={18} color="var(--red)" />}
            <span style={{ fontWeight: 500, color: result.ok ? 'var(--green)' : 'var(--red)' }}>
              {result.ok ? 'Import successful' : 'Import failed'}
            </span>
          </div>
          {result.ok && (
            <div style={{ display: 'flex', gap: 24, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 24, fontFamily: 'Playfair Display', fontWeight: 600, color: 'var(--green)' }}>{result.inserted}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>imported</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontFamily: 'Playfair Display', fontWeight: 600, color: 'var(--text-muted)' }}>{result.skipped}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>duplicates skipped</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontFamily: 'Playfair Display', fontWeight: 600, color: 'var(--text)' }}>{result.total}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>total in file</div>
              </div>
            </div>
          )}
          {result.error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{result.error}</p>}
        </div>
      )}

      {/* Apply rules */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>
            <Zap size={14} color="var(--accent)" style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Apply Auto-Rules
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Re-categorize all uncategorized transactions using saved keyword rules
          </div>
        </div>
        <button className="btn btn-primary" onClick={applyRules} disabled={applyingRules}>
          {applyingRules ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Running...</> : 'Apply Rules'}
        </button>
      </div>

      {/* Format guide */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Export from ABN AMRO
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { format: 'CSV (recommended)', steps: 'Internet Banking → Transactions → Download → Tab-delimited TXT' },
            { format: 'Excel (.xlsx)', steps: 'Internet Banking → Transactions → Download → Excel format' },
            { format: 'MT940', steps: 'Internet Banking → Download → MT940 format (most complete data)' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <FileText size={15} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{item.format}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.steps}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch history */}
      {batches.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Import History
          </h3>
          <table className="table">
            <thead><tr>
              <th>File</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Transactions</th>
              <th style={{ textAlign: 'right' }}>Imported</th>
            </tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize: 13, color: 'var(--text)' }}>
                    <FileText size={13} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--text-dim)' }} />
                    {b.filename}
                  </td>
                  <td><span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>{b.file_type || 'auto'}</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13 }}>{b.transaction_count}</td>
                  <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {new Date(b.imported_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
