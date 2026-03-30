import { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, RefreshCw, Edit2, Save, X } from 'lucide-react';
import { api } from '../utils/api';
import { Toast, EmptyState, CategoryBadge, CategorySelect } from '../components/UI';

export default function Rules({ categories }) {
  const [rules, setRules] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [catId, setCatId] = useState('');
  const [field, setField] = useState('description');
  const [toast, setToast] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyBanner, setApplyBanner] = useState(null); // { count, keyword }
  const [editRule, setEditRule] = useState(null); // { id, keyword, match_field, category_id }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => api.getRules().then(setRules);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!keyword.trim() || !catId) return showToast('Fill in keyword and category', 'error');
    const kw = keyword.trim();
    try {
      await api.createRule({ keyword: kw, category_id: parseInt(catId), match_field: field });
      setKeyword('');
      setCatId('');
      load();

      // Auto-apply rules and show how many matched
      setApplying(true);
      try {
        const result = await api.applyRules();
        setApplyBanner({ count: result.updated, keyword: kw });
        setTimeout(() => setApplyBanner(null), 8000);
      } catch {}
      setApplying(false);

      showToast(`Rule "${kw}" created`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const applyAll = async () => {
    setApplying(true);
    try {
      const result = await api.applyRules();
      showToast(`${result.updated} transaction${result.updated !== 1 ? 's' : ''} re-categorized`);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  const saveEdit = async () => {
    if (!editRule.keyword.trim() || !editRule.category_id) return;
    try {
      await api.updateRule(editRule.id, {
        keyword: editRule.keyword.trim(),
        category_id: parseInt(editRule.category_id),
        match_field: editRule.match_field,
      });
      setEditRule(null);
      load();
      showToast('Rule updated');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const del = async (id) => {
    await api.deleteRule(id);
    load();
    showToast('Rule deleted');
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Auto-Rules
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Keyword rules automatically assign categories when importing transactions
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={applyAll}
          disabled={applying}
          style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <RefreshCw size={13} style={applying ? { animation: 'spin 1s linear infinite' } : {}} />
          {applying ? 'Applying…' : 'Apply All Rules'}
        </button>
      </div>

      {/* Auto-apply result banner */}
      {applyBanner !== null && (
        <div style={{
          background: applyBanner.count > 0 ? 'var(--accent)12' : 'var(--surface)',
          border: `1px solid ${applyBanner.count > 0 ? 'var(--accent)44' : 'var(--border)'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Zap size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            Rule <strong>"{applyBanner.keyword}"</strong> applied —{' '}
            {applyBanner.count > 0
              ? <><strong style={{ color: 'var(--accent)' }}>{applyBanner.count}</strong> previously uncategorized transaction{applyBanner.count !== 1 ? 's' : ''} matched and re-categorized</>
              : 'no uncategorized transactions matched'}
          </span>
          <button onClick={() => setApplyBanner(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

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
            <CategorySelect
              categories={categories}
              value={catId}
              onChange={e => setCatId(e.target.value)}
              emptyLabel="Select category..."
            />
          </div>
          <button className="btn btn-primary" onClick={create} disabled={applying}>
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
                editRule?.id === r.id ? (
                  <tr key={r.id} style={{ background: 'var(--surface2)' }}>
                    <td>
                      <input
                        className="input"
                        style={{ fontFamily: 'DM Mono', fontSize: 13, padding: '4px 8px', width: 180 }}
                        value={editRule.keyword}
                        autoFocus
                        onChange={e => setEditRule(m => ({ ...m, keyword: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditRule(null); }}
                      />
                    </td>
                    <td>
                      <select className="input" style={{ fontSize: 12 }} value={editRule.match_field}
                        onChange={e => setEditRule(m => ({ ...m, match_field: e.target.value }))}>
                        <option value="description">Description</option>
                        <option value="counterparty">Counterparty</option>
                      </select>
                    </td>
                    <td>
                      <CategorySelect
                        categories={categories}
                        value={editRule.category_id}
                        onChange={e => setEditRule(m => ({ ...m, category_id: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={saveEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }} title="Save">
                          <Save size={14} />
                        </button>
                        <button onClick={() => setEditRule(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }} title="Cancel">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono', fontSize: 13, background: 'var(--surface2)', padding: '3px 8px', borderRadius: 6, color: 'var(--text)' }}>
                        {r.keyword}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.match_field}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {r.parent_name && (
                          <>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.parent_icon} {r.parent_name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>›</span>
                          </>
                        )}
                        <CategoryBadge name={r.category_name} color={r.category_color} icon={r.category_icon} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditRule({ id: r.id, keyword: r.keyword, match_field: r.match_field, category_id: String(r.category_id) })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
