import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

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
export function CategorySelect({ categories, value, onChange, style, className, emptyLabel = 'Select category...', includeEmpty = true }) {
  const parents = categories.filter(c => !c.parent_id);
  const childrenMap = {};
  categories.filter(c => c.parent_id).forEach(c => {
    if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
    childrenMap[c.parent_id].push(c);
  });
  return (
    <select className={className || 'input'} value={value} onChange={onChange} style={style}>
      {includeEmpty && <option value="">{emptyLabel}</option>}
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
