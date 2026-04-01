import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, RefreshCw, Trash2, Tag, Zap, X, AlertTriangle, CalendarX } from 'lucide-react';
import { api } from '../utils/api';
import { Loader, EmptyState, AmountDisplay, CategoryBadge, CategorySelect, Toast, PeriodSelector, Modal } from '../components/UI';

const PAGE = 100;

export default function Transactions({ categories, onRefresh, initialFilters }) {
  const [txns, setTxns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState(initialFilters?.uncategorized ? 'none' : '');
  const [filterType, setFilterType] = useState(initialFilters?.type || '');
  const [filterAccount, setFilterAccount] = useState('');
  const [period, setPeriod] = useState(initialFilters?.period || '');
  const [periods, setPeriods] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showDeleteMonth, setShowDeleteMonth] = useState(false);
  const [showDeleteRange, setShowDeleteRange] = useState(false);
  const [deleteFrom, setDeleteFrom] = useState('');
  const [deleteTo, setDeleteTo] = useState('');
  const [deletePreview, setDeletePreview] = useState(null); // number | null
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkCat, setBulkCat] = useState('');
  const [toast, setToast] = useState(null);
  const [inlineEdit, setInlineEdit] = useState(null); // id of row with category select open
  const [detailsEdit, setDetailsEdit] = useState(null); // { id, value }
  const [ruleModal, setRuleModal] = useState(null); // { keyword, field, category_id }
  const searchTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: PAGE, search, category_id: filterCat, type: filterType, account_id: filterAccount };
    if (period) { const [y, m] = period.split('-'); params.year = y; params.month = m; }
    api.getTransactions(params)
      .then(data => { setTxns(data.transactions); setTotal(data.total); })
      .finally(() => setLoading(false));
  }, [search, filterCat, filterType, filterAccount, period]);

  useEffect(() => {
    api.getPeriods().then(setPeriods);
    api.getAccounts().then(setAccounts);
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

  const saveCategory = async (id, category_id) => {
    await api.updateTransaction(id, { category_id: category_id ? parseInt(category_id) : null });
    setInlineEdit(null);
    load();
    onRefresh?.();
  };

  const saveDetails = async (id, details) => {
    await api.updateTransaction(id, { details: details || null });
    setDetailsEdit(null);
    setTxns(prev => prev.map(t => t.id === id ? { ...t, details: details || null } : t));
  };

  const previewDeleteRange = useCallback(async (from, to) => {
    if (!from || !to || from > to) { setDeletePreview(null); return; }
    const { count } = await api.countTransactions(from, to).catch(() => ({ count: null }));
    setDeletePreview(count);
  }, []);

  const handleDeleteRange = async () => {
    if (!deleteFrom || !deleteTo || deleteFrom > deleteTo) return;
    setDeleting(true);
    try {
      const result = await api.deleteRange(deleteFrom, deleteTo);
      showToast(`${result.deleted} transactions deleted`);
      setShowDeleteRange(false);
      setDeleteFrom(''); setDeleteTo(''); setDeletePreview(null);
      load();
      onRefresh?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteMonth = async () => {
    const [y, m] = period.split('-');
    try {
      const result = await api.deleteMonth(y, m);
      setShowDeleteMonth(false);
      showToast(`${result.deleted} transactions deleted`);
      load();
      onRefresh?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const openRuleModal = (tx) => {
    setRuleModal({
      keyword: tx.description || tx.counterparty || '',
      field: tx.description ? 'description' : 'counterparty',
      category_id: tx.category_id ? String(tx.category_id) : '',
    });
  };

  const saveRule = async () => {
    if (!ruleModal.keyword.trim() || !ruleModal.category_id) return;
    try {
      await api.createRule({ keyword: ruleModal.keyword.trim(), category_id: parseInt(ruleModal.category_id), match_field: ruleModal.field });
      const result = await api.applyRules();
      setRuleModal(null);
      showToast(`Rule created · ${result.updated} transaction${result.updated !== 1 ? 's' : ''} re-categorized`);
      load();
      onRefresh?.();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const deleteTxn = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await api.deleteTransaction(id);
    showToast('Transaction deleted');
    load();
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {ruleModal && (
        <Modal title="Create Auto-Rule" onClose={() => setRuleModal(null)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyword</label>
            <input className="input" value={ruleModal.keyword} autoFocus
              onChange={e => setRuleModal(m => ({ ...m, keyword: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveRule()} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Match in</label>
            <select className="input" value={ruleModal.field} onChange={e => setRuleModal(m => ({ ...m, field: e.target.value }))}>
              <option value="description">Description</option>
              <option value="counterparty">Counterparty</option>
            </select>
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assign to category</label>
            <CategorySelect categories={categories} value={ruleModal.category_id}
              onChange={e => setRuleModal(m => ({ ...m, category_id: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveRule}
              disabled={!ruleModal.keyword.trim() || !ruleModal.category_id}>
              <Zap size={14} /> Save Rule & Apply
            </button>
            <button className="btn btn-ghost" onClick={() => setRuleModal(null)}><X size={14} /></button>
          </div>
        </Modal>
      )}

      {showDeleteMonth && (
        <Modal title="Delete Entire Month" onClose={() => setShowDeleteMonth(false)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
              This will permanently delete <strong>all transactions</strong> for{' '}
              <strong>{new Date(period + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>.
              This cannot be undone.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteMonth}>
              Yes, delete month
            </button>
            <button className="btn btn-ghost" onClick={() => setShowDeleteMonth(false)}><X size={14} /></button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Transactions
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{total} records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {period && (
            <button className="btn btn-danger" onClick={() => setShowDeleteMonth(true)}>
              <Trash2 size={13} /> Delete Month
            </button>
          )}
          <button className="btn btn-ghost" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
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
          <select className="input" style={{ width: 'auto' }} value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <CategorySelect
            categories={categories}
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{ width: 'auto' }}
            emptyLabel="All categories"
            includeEmpty
            extraOptions={[{ value: 'none', label: '⚠ Uncategorized' }]}
          />
          <select className="input" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-dim)' }}
            onClick={() => { setSearch(''); setFilterCat(''); setFilterType(''); setFilterAccount(''); setPeriod(''); }}>
            <Filter size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Delete range panel */}
      {showDeleteRange ? (
        <div className="card animate-fade-up" style={{ marginBottom: 16, borderColor: '#ef444433', background: '#ef444408' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarX size={15} color="#ef4444" /> Delete transactions by date range
            </span>
            <button onClick={() => { setShowDeleteRange(false); setDeleteFrom(''); setDeleteTo(''); setDeletePreview(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>From</label>
              <input type="date" className="input" style={{ width: 160 }} value={deleteFrom}
                onChange={e => { setDeleteFrom(e.target.value); previewDeleteRange(e.target.value, deleteTo); }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>To</label>
              <input type="date" className="input" style={{ width: 160 }} value={deleteTo}
                onChange={e => { setDeleteTo(e.target.value); previewDeleteRange(deleteFrom, e.target.value); }} />
            </div>
            {deletePreview !== null && (
              <div style={{ fontSize: 13, color: deletePreview > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 500 }}>
                {deletePreview > 0 ? `${deletePreview} transactions will be deleted` : 'No transactions in this range'}
              </div>
            )}
            <button
              className="btn btn-danger"
              disabled={!deleteFrom || !deleteTo || deleteFrom > deleteTo || deletePreview === 0 || deleting}
              onClick={handleDeleteRange}
            >
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, color: '#ef4444', borderColor: '#ef444433' }}
            onClick={() => setShowDeleteRange(true)}>
            <CalendarX size={13} /> Delete by date range
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card animate-fade-up" style={{ marginBottom: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tag size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{selected.size} selected</span>
          <CategorySelect
            categories={categories}
            value={bulkCat}
            onChange={e => setBulkCat(e.target.value)}
            style={{ width: 220 }}
            emptyLabel="Choose category..."
          />
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
                  <th>Details</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {txns.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                    </td>
                    <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {tx.date}
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <span style={{ fontSize: 13, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.counterparty || '—'}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      {detailsEdit?.id === tx.id ? (
                        <input
                          className="input"
                          style={{ fontSize: 12, padding: '4px 8px', width: 180 }}
                          value={detailsEdit.value}
                          autoFocus
                          onChange={e => setDetailsEdit({ id: tx.id, value: e.target.value })}
                          onBlur={() => saveDetails(tx.id, detailsEdit.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveDetails(tx.id, detailsEdit.value);
                            if (e.key === 'Escape') setDetailsEdit(null);
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => setDetailsEdit({ id: tx.id, value: tx.details || '' })}
                          style={{ cursor: 'pointer', fontSize: 12, color: tx.details ? 'var(--text)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={tx.details || 'Click to add details'}
                        >
                          {tx.details || <span style={{ fontStyle: 'italic' }}>+ add note</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {inlineEdit === tx.id ? (
                        <CategorySelect
                          categories={categories}
                          value={tx.category_id || ''}
                          onChange={e => saveCategory(tx.id, e.target.value)}
                          style={{ width: 190, fontSize: 12 }}
                          emptyLabel="Uncategorized"
                        />
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
                    <td>
                      {tx.account_name ? (
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 20,
                          background: (tx.account_color || '#6366f1') + '22',
                          color: tx.account_color || '#6366f1',
                          border: `1px solid ${(tx.account_color || '#6366f1')}44`,
                          whiteSpace: 'nowrap',
                        }}>
                          {tx.account_name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <AmountDisplay amount={tx.amount} type={tx.transaction_type} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => openRuleModal(tx)} title="Create auto-rule from this transaction"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}>
                          <Zap size={13} />
                        </button>
                        <button onClick={() => deleteTxn(tx.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
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
