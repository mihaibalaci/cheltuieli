import { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, Info } from 'lucide-react';
import { api } from '../utils/api';
import { Toast, EmptyState, CategoryBadge } from '../components/UI';

export default function Rules({ categories }) {
  const [rules, setRules] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [catId, setCatId] = useState('');
  const [field, setField] = useState('description');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => api.getRules().then(setRules);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!keyword.trim() || !catId) return showToast('Fill in keyword and category', 'error');
    try {
      await api.createRule({ keyword: keyword.trim(), category_id: parseInt(catId), match_field: field });
      setKeyword('');
      setCatId('');
      load();
      showToast('Rule created');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const del = async (id) => {
    await api.deleteRule(id);
    load();
    showToast('Rule deleted');
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Auto-Rules
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Keyword rules automatically assign categories when importing transactions
        </p>
      </div>

      {/* Info */}
      <div className="card" style={{ marginBottom: 20, background: 'var(--accent)0d', borderColor: 'var(--accent)33', display: 'flex', gap: 10 }}>
        <Info size={15} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Rules match against transaction descriptions and counterparty names. The first matching rule wins.
          After editing rules, go to Import and click "Apply Rules" to re-categorize existing uncategorized transactions.
        </p>
      </div>

      {/* Create rule */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Add Rule
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Keyword</label>
            <input className="input" placeholder="e.g. Albert Heijn" value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Match in</label>
            <select className="input" value={field} onChange={e => setField(e.target.value)}>
              <option value="description">Description</option>
              <option value="counterparty">Counterparty</option>
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Assign to category</label>
            <select className="input" value={catId} onChange={e => setCatId(e.target.value)}>
              <option value="">Select category...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={create}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Rules list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rules.length === 0 ? (
          <EmptyState icon="⚡" title="No rules yet" subtitle="Add your first keyword rule above" />
        ) : (
          <table className="table">
            <thead><tr>
              <th><Zap size={12} style={{ verticalAlign: 'middle' }} /> Keyword</th>
              <th>Match Field</th>
              <th>Category</th>
              <th style={{ width: 50 }}></th>
            </tr></thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontFamily: 'DM Mono', fontSize: 13, background: 'var(--surface2)', padding: '3px 8px', borderRadius: 6, color: 'var(--text)' }}>
                      {r.keyword}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.match_field}</td>
                  <td>
                    <CategoryBadge name={r.category_name} color={r.category_color} icon={r.category_icon} />
                  </td>
                  <td>
                    <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
