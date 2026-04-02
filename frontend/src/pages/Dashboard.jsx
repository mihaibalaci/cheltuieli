import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, CreditCard, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { Loader, EmptyState, PeriodSelector, CategoryBadge } from '../components/UI';

const fmt = (n) => '€' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function StatCard({ label, value, icon: Icon, color, sub, onClick }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160, cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
      onClick={onClick}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = ''; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>{label}</span>
        {Icon && <Icon size={16} color={color} />}
      </div>
      <div style={{ fontFamily: 'Playfair Display', fontSize: 26, fontWeight: 600, color }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function AccountBalanceCard({ accounts, total }) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Account Balances
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {accounts.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: a.color || '#6366f1', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{a.name}</span>
            </div>
            <span style={{
              fontFamily: 'DM Mono', fontSize: 13, fontWeight: 500,
              color: (a.balance || 0) >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {fmt(a.balance || 0)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
        <span style={{
          fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700,
          color: total >= 0 ? 'var(--green)' : 'var(--red)',
        }}>
          {fmt(total)}
        </span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [balances, setBalances] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPeriods().then(p => {
      setPeriods(p);
      if (p.length) setPeriod(p[0].period);
    });
    api.getMonthlyTrend(12).then(setTrend);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (period) {
      const [y, m] = period.split('-');
      params.year = y; params.month = m;
    }
    Promise.all([
      api.getSummary(params),
      api.getTopMerchants({ ...params, limit: 8 }),
      api.getAccountBalances(params),
    ]).then(([s, m, b]) => {
      setSummary(s);
      setMerchants(m);
      setBalances(b);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period]);

  const net = summary ? (summary.totals?.total_income || 0) - (summary.totals?.total_spent || 0) : 0;

  const pieData = summary?.byCategory?.filter(c => c.spent > 0).map(c => ({
    name: c.name, value: c.spent, color: c.color, icon: c.icon
  })) || [];

  const trendFormatted = trend.map(t => ({
    ...t,
    label: new Date(t.month + '-01').toLocaleString('default', { month: 'short' }),
  }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Overview
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {period ? new Date(period + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : 'All time'}
          </p>
        </div>
        <PeriodSelector periods={periods} value={period} onChange={setPeriod} />
      </div>

      {loading ? <Loader text="Loading report..." /> : !summary ? (
        <EmptyState icon="📊" title="No data yet" subtitle="Import your bank transactions to get started" />
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="Total Spent" value={fmt(summary.totals?.total_spent)}
              icon={TrendingDown} color="var(--red)"
              sub={`${summary.totals?.total_transactions || 0} transactions`}
              onClick={() => onNavigate?.('transactions', { type: 'debit', period })} />
            <StatCard label="Total Income" value={fmt(summary.totals?.total_income)}
              icon={TrendingUp} color="var(--green)"
              sub={summary.incomeBreakdown
                ? `Salary ${fmt(summary.incomeBreakdown.salary)} · Rent ${fmt(summary.incomeBreakdown.rent)}`
                : 'Salaries + rent income'}
              onClick={() => onNavigate?.('transactions', { type: 'credit', period })} />
            <StatCard label="Net Balance" value={fmt(Math.abs(net))}
              icon={CreditCard} color={net >= 0 ? 'var(--green)' : 'var(--red)'}
              sub={net >= 0 ? 'surplus' : 'deficit'} />
            {summary.uncategorized > 0 && (
              <StatCard label="Uncategorized" value={summary.uncategorized}
                icon={AlertCircle} color="var(--accent)"
                sub="transactions need review"
                onClick={() => onNavigate?.('transactions', { uncategorized: true, period })} />
            )}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Pie chart */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Spending by Category
              </h3>
              {pieData.length === 0 ? (
                <EmptyState icon="🥧" title="No spending data" />
              ) : (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200 }}>
                    {pieData.slice(0, 8).map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.icon} {d.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--red)' }}>{fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trend chart */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                12-Month Trend
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendFormatted} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + (v/1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="spent" name="Spent" fill="var(--red)" opacity={0.8} radius={[3,3,0,0]} />
                  <Bar dataKey="income" name="Income" fill="var(--green)" opacity={0.8} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {/* Account Balances */}
            {balances && balances.accounts?.length > 0 && (
              <AccountBalanceCard accounts={balances.accounts} total={balances.total} />
            )}

            {/* Category breakdown table */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Category Breakdown
              </h3>
              <table className="table">
                <thead><tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Spent</th>
                  <th style={{ textAlign: 'right' }}>Txns</th>
                </tr></thead>
                <tbody>
                  {summary.byCategory?.filter(c => c.spent > 0).map(c => (
                    <tr key={c.id}>
                      <td><CategoryBadge name={c.name} color={c.color} icon={c.icon} /></td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13, color: 'var(--red)' }}>{fmt(c.spent)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top merchants */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Top Merchants
              </h3>
              {merchants.length === 0 ? (
                <EmptyState icon="🏪" title="No merchant data" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {merchants.map((m, i) => {
                    const max = merchants[0]?.total || 1;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.counterparty || 'Unknown'}</span>
                          <span style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--red)' }}>{fmt(m.total)}</span>
                        </div>
                        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(m.total / max) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
