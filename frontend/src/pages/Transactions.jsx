import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, RefreshCw, Trash2, Tag } from 'lucide-react';
import { api } from '../utils/api';
import { Loader, EmptyState, AmountDisplay, CategoryBadge, Toast, PeriodSelector } from '../components/UI';

const PAGE = 100;

export default function Transactions({ categories, onRefresh }) {
  const [txns, setTxns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const [period, setPeriod] = useState('');
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [bulkCat, setBulkCat] = useState('');
  const [toast, setToast] = useState(null);
  const [inlineEdit, setInlineEdit] = useState(null);
  const searchTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: PAGE, search, category_id: filterCat, type: filterType };
    if (period) { const [y, m] = period.split('-'); params.year = y; params.month = m; }
    api.getTransactions(params)
      .then(data => { setTxns(data.transactions); setTotal(data.total); })
      .finally(() => setLoading(false));
  }, [search, filterCat, filterType, period]);

  useEffect(() => {
    api.getPeriods().then(setPeriods);
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, 300);
    return () => clearTimeout(searchTimer.current);
  }, [load]);

  const toggleSelect = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectAll = () => {
    selected.size === txns.length ? setSelected(new Set()) : setSelected(new Set(txns.map(t => t.id)));
  };

  const applyBulkCat = async () => {
    if (!bulkCat || !selected.size) return;
    await api.bulkCategorize([...selected], parseInt(bulkCat));
    setSelected(new Set());
    showToast(`Updated ${selected.size} transactions`);
    load();
    onRefresh?.();
  };

  const saveInlineEdit = async (id, category_id) => {
    await api.updateTransaction(id, { category_id: parseInt(category_id) });
    setInlineEdit(null);
    load();
    onRefresh?.();
  };

  const deleteTxn = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await api.deleteTransaction(id);
    showToast('Transaction deleted');
    load();
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Transactions
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{total} records</p>
        </div>
        <button className="btn btn-ghost" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search description or counterparty..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <PeriodSelector periods={periods} value={period} onChange={setPeriod} />
          <select className="input" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            <option value="null">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-dim)' }}
            onClick={() => { setSearch(''); setFilterCat(''); setFilterType(''); setPeriod(''); }}>
            <Filter size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card animate-fade-up" style={{ marginBottom: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tag size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{selected.size} selected</span>
          <select className="input" style={{ width: 200 }} value={bulkCat} onChange={e => setBulkCat(e.target.value)}>
            <option value="">Choose category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={applyBulkCat}>Apply</button>
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <Loader text="Loading transactions..." /> : txns.length === 0 ? (
          <EmptyState icon="💸" title="No transactions found" subtitle="Import a file or adjust filters" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={selected.size === txns.length && txns.length > 0}
                      onChange={selectAll} style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                  </th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Counterparty</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {txns.map(tx => (
                  <tr key={tx.id} style={{ opacity: selected.has(tx.id) ? 1 : undefined }}>
                    <td>
                      <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                    </td>
                    <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {tx.date}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <span style={{ fontSize: 13, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.counterparty || '—'}
                    </td>
                    <td>
                      {inlineEdit === tx.id ? (
                        <select className="input" style={{ width: 180, fontSize: 12 }}
                          defaultValue={tx.category_id || ''}
                          onBlur={e => saveInlineEdit(tx.id, e.target.value)}
                          onChange={e => saveInlineEdit(tx.id, e.target.value)}
                          autoFocus>
                          <option value="">Uncategorized</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      ) : (
                        <div onClick={() => setInlineEdit(tx.id)} style={{ cursor: 'pointer' }}>
                          {tx.category_id ? (
                            <CategoryBadge name={tx.category_name} color={tx.category_color} icon={tx.category_icon} />
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '2px 8px', border: '1px dashed var(--border)', borderRadius: 20, cursor: 'pointer' }}>
                              + assign
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <AmountDisplay amount={tx.amount} type={tx.transaction_type} />
                    </td>
                    <td>
                      <button onClick={() => deleteTxn(tx.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 12 }}>
          Showing first {PAGE} of {total} transactions. Use filters to narrow results.
        </p>
      )}
    </div>
  );
}
