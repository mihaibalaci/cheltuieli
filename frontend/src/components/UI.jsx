import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function Modal({ title, onClose, children, width = '500px' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card animate-fade-up w-full" style={{ maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontFamily: 'Playfair Display', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
            {title}
          </h2>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, type = 'info', onClose }) {
  const icons = { info: Info, success: CheckCircle, error: AlertCircle };
  const colors = { info: 'var(--blue)', success: 'var(--green)', error: 'var(--red)' };
  const Icon = icons[type];
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-up" style={{
      background: 'var(--surface)',
      border: `1px solid ${colors[type]}40`,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      maxWidth: 360,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    }}>
      <Icon size={16} color={colors[type]} />
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 'auto' }}>
        <X size={14} />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13 }}>{subtitle}</div>}
    </div>
  );
}

export function Loader({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px', color: 'var(--text-muted)' }}>
      <div className="spinner" />
      {text && <span>{text}</span>}
    </div>
  );
}

export function CategoryBadge({ name, color, icon }) {
  return (
    <span className="badge" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
      {icon && <span>{icon}</span>}
      {name}
    </span>
  );
}

export function AmountDisplay({ amount, type }) {
  const sign = type === 'credit' ? '+' : '-';
  return (
    <span className={type === 'credit' ? 'amount-credit' : 'amount-debit'}
      style={{ fontFamily: 'DM Mono', fontSize: 13, fontWeight: 500 }}>
      {sign}€{Number(amount).toFixed(2)}
    </span>
  );
}

// Renders a <select> with categories grouped by parent.
// Parents with subcategories show the parent as selectable, then subcategories indented.
export function CategorySelect({ categories, value, onChange, style, className, emptyLabel = 'Select category...', includeEmpty = true, extraOptions = [] }) {
  const parents = categories.filter(c => !c.parent_id);
  const childrenMap = {};
  categories.filter(c => c.parent_id).forEach(c => {
    if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
    childrenMap[c.parent_id].push(c);
  });
  return (
    <select className={className || 'input'} value={value} onChange={onChange} style={style}>
      {includeEmpty && <option value="">{emptyLabel}</option>}
      {extraOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {parents.map(p => [
        <option key={p.id} value={p.id}>{p.icon} {p.name}</option>,
        ...(childrenMap[p.id] || []).map(s =>
          <option key={s.id} value={s.id}>&nbsp;&nbsp;&nbsp;↳ {s.icon} {s.name}</option>
        ),
      ])}
    </select>
  );
}

export function PeriodSelector({ periods, value, onChange }) {
  return (
    <select className="input" style={{ width: 'auto' }} value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">All time</option>
      {periods.map(p => (
        <option key={p.period} value={p.period}>
          {new Date(p.year, p.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          {' '}({p.count} txn)
        </option>
      ))}
    </select>
  );
}


// Searchable category dropdown with type-to-filter
export function SearchableCategorySelect({ categories, value, onChange, style, emptyLabel = 'Select category...', includeEmpty = true, extraOptions = [] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const parents = categories.filter(c => !c.parent_id);
  const childrenMap = {};
  categories.filter(c => c.parent_id).forEach(c => {
    if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
    childrenMap[c.parent_id].push(c);
  });

  const lowerSearch = search.toLowerCase();
  const matchesCat = (c) => c.name.toLowerCase().includes(lowerSearch);

  // Build filtered list
  const filtered = [];
  for (const p of parents) {
    const subs = (childrenMap[p.id] || []).filter(matchesCat);
    if (matchesCat(p) || subs.length > 0) {
      filtered.push({ ...p, _isSub: false });
      // If parent matches, show all subs; otherwise only matching subs
      const showSubs = matchesCat(p) ? (childrenMap[p.id] || []) : subs;
      showSubs.forEach(s => filtered.push({ ...s, _isSub: true }));
    }
  }

  // Find display label for current value
  let displayLabel = emptyLabel;
  if (value) {
    const extra = extraOptions.find(o => String(o.value) === String(value));
    if (extra) {
      displayLabel = extra.label;
    } else {
      const cat = categories.find(c => String(c.id) === String(value));
      if (cat) displayLabel = `${cat.icon} ${cat.name}`;
    }
  }

  const select = (val) => {
    onChange({ target: { value: val } });
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        className="input"
        onClick={() => setOpen(!open)}
        style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', minWidth: 180 }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxHeight: 280, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={inputRef}
              className="input"
              placeholder="Search categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px' }}
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 230 }}>
            {includeEmpty && (
              <div onClick={() => select('')} style={optionStyle(String(value) === '')}>
                {emptyLabel}
              </div>
            )}
            {extraOptions.map(o => (
              <div key={o.value} onClick={() => select(o.value)} style={optionStyle(String(value) === String(o.value))}>
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>No categories found</div>
            )}
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => select(String(c.id))}
                style={{
                  ...optionStyle(String(value) === String(c.id)),
                  paddingLeft: c._isSub ? 28 : 14,
                }}
              >
                {c._isSub && <span style={{ color: 'var(--text-dim)', marginRight: 4 }}>↳</span>}
                <span style={{ marginRight: 6 }}>{c.icon}</span>
                {c.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function optionStyle(isActive) {
  return {
    padding: '7px 14px',
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    background: isActive ? 'var(--accent)15' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text)',
    transition: 'background 0.1s',
  };
}
