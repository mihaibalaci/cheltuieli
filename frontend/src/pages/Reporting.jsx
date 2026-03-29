import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart2, GitCompare, Layers } from 'lucide-react';
import { api } from '../utils/api';
import { Loader, EmptyState } from '../components/UI';

const fmt = (n) => '€' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtK = (v) => v >= 1000 ? '€' + (v / 1000).toFixed(1) + 'k' : '€' + Math.round(v);
const fmtMonth = (m) => new Date(m + '-02').toLocaleString('en', { month: 'short', year: '2-digit' });
const pctFmt = (n) => (n > 0 ? '+' : '') + n.toFixed(1) + '%';

// ─── Intelligence engine ───────────────────────────────────────────────────

function computeInsights(months, categories) {
  if (months.length < 4) return [];
  const lastMonth = months[months.length - 1];
  const baseline = months.slice(-4, -1); // 3 months before last

  return categories
    .map(cat => {
      const lastSpent = cat.monthly.find(m => m.month === lastMonth)?.spent || 0;
      const baselineValues = baseline.map(bm => cat.monthly.find(m => m.month === bm)?.spent || 0);
      const avgBaseline = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;

      if (lastSpent < 5 && avgBaseline < 5) return null;
      const change = lastSpent - avgBaseline;
      const pct = avgBaseline > 0.5 ? (change / avgBaseline) * 100 : (lastSpent > 0 ? 100 : 0);
      if (Math.abs(pct) < 8 && Math.abs(change) < 30) return null;

      // 3-month direction (is trend consistent?)
      const last3 = months.slice(-3).map(m => cat.monthly.find(d => d.month === m)?.spent || 0);
      const trending = last3.length === 3
        ? (last3[2] > last3[1] && last3[1] > last3[0] ? 'up'
          : last3[2] < last3[1] && last3[1] < last3[0] ? 'down' : 'mixed')
        : 'mixed';

      return { cat, lastSpent, avgBaseline, change, pct, trending };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 8);
}

function InsightCard({ item }) {
  const isUp = item.change > 0;
  const isConsistent = item.trending !== 'mixed';
  const accent = isUp ? 'var(--red)' : 'var(--green)';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${accent}33`,
      borderRadius: 10, padding: '14px 16px', minWidth: 220, flex: '1 1 220px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>
          {item.cat.icon} {item.cat.name}
        </span>
        <Icon size={14} color={accent} />
      </div>

      <div style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700, color: accent, marginBottom: 2 }}>
        {pctFmt(item.pct)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        vs 3-month average
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-dim)' }}>
        <span>Now: <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{fmt(item.lastSpent)}</strong></span>
        <span>Avg: <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{fmt(item.avgBaseline)}</strong></span>
        <span style={{ color: accent, fontFamily: 'DM Mono' }}>{item.change > 0 ? '+' : ''}{fmt(item.change)}</span>
      </div>

      {isConsistent && (
        <div style={{
          marginTop: 8, fontSize: 11, color: accent,
          background: accent + '15', borderRadius: 4, padding: '3px 7px', display: 'inline-block',
        }}>
          {item.trending === 'up' ? '↑ Rising 3 months in a row' : '↓ Falling 3 months in a row'}
        </div>
      )}
    </div>
  );
}

// ─── Custom tooltip ────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Tab bar ───────────────────────────────────────────────────────────────

function Tabs({ value, onChange, tabs }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 16px', borderRadius: 8, border: '1px solid',
          borderColor: value === t.id ? 'var(--accent)55' : 'var(--border)',
          background: value === t.id ? 'var(--accent)12' : 'transparent',
          color: value === t.id ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer', fontSize: 13, fontWeight: value === t.id ? 600 : 400,
          fontFamily: 'inherit', transition: 'all 0.15s',
        }}>
          <t.icon size={14} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Month-over-Month tab ──────────────────────────────────────────────────

function MonthOverMonth({ trend }) {
  const data = useMemo(() => trend.map((t, i) => {
    const prev = trend[i - 1];
    const momPct = prev && prev.spent > 0 ? ((t.spent - prev.spent) / prev.spent) * 100 : null;
    return {
      ...t,
      label: fmtMonth(t.month),
      momPct,
      net: (t.income || 0) - (t.spent || 0),
    };
  }), [trend]);

  if (!data.length) return <EmptyState icon="📈" title="No trend data" subtitle="Import transactions to see trends" />;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={cardTitle}>Monthly Spending & Income</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
            <Bar dataKey="spent" name="Spent" fill="var(--red)" opacity={0.85} radius={[3, 3, 0, 0]} />
            <Bar dataKey="income" name="Income" fill="var(--green)" opacity={0.85} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 style={cardTitle}>Month-over-Month Detail</h3>
        <table className="table">
          <thead><tr>
            <th>Month</th>
            <th style={{ textAlign: 'right' }}>Spent</th>
            <th style={{ textAlign: 'right' }}>Income</th>
            <th style={{ textAlign: 'right' }}>Net</th>
            <th style={{ textAlign: 'right' }}>MoM Change</th>
          </tr></thead>
          <tbody>
            {data.slice().reverse().map((row, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--text)', fontWeight: 500 }}>{row.label}</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono', color: 'var(--red)', fontSize: 13 }}>{fmt(row.spent)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono', color: 'var(--green)', fontSize: 13 }}>{fmt(row.income)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13, color: row.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                </td>
                <td style={{ textAlign: 'right', fontSize: 12 }}>
                  {row.momPct == null ? (
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                  ) : (
                    <span style={{ color: row.momPct > 0 ? 'var(--red)' : 'var(--green)', fontFamily: 'DM Mono' }}>
                      {pctFmt(row.momPct)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Year-over-Year tab ────────────────────────────────────────────────────

const YEAR_COLORS = ['var(--accent)', 'var(--blue)', '#f97316', '#a855f7', '#ec4899'];

function YearOverYear({ yoy }) {
  const { years, data } = yoy;
  if (!data?.length) return <EmptyState icon="📅" title="No multi-year data" subtitle="Import transactions across multiple years to compare" />;

  // Change table: current year vs previous year
  const curYear = years[years.length - 1];
  const prevYear = years[years.length - 2];

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={cardTitle}>Spending by Year · Monthly View</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
            {years.map((y, i) => (
              <Bar key={y} dataKey={`${y}_spent`} name={y} fill={YEAR_COLORS[i % YEAR_COLORS.length]} opacity={0.85} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {prevYear && (
        <div className="card">
          <h3 style={cardTitle}>{prevYear} vs {curYear} · Difference</h3>
          <table className="table">
            <thead><tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>{prevYear}</th>
              <th style={{ textAlign: 'right' }}>{curYear}</th>
              <th style={{ textAlign: 'right' }}>Change (€)</th>
              <th style={{ textAlign: 'right' }}>Change (%)</th>
            </tr></thead>
            <tbody>
              {data.map((row, i) => {
                const prev = row[`${prevYear}_spent`] || 0;
                const cur = row[`${curYear}_spent`] || 0;
                const diff = cur - prev;
                const pct = prev > 0 ? (diff / prev) * 100 : null;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{row.monthName}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text-muted)' }}>{fmt(prev)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13 }}>{fmt(cur)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13, color: diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text-dim)' }}>
                      {diff !== 0 ? (diff > 0 ? '+' : '') + fmt(diff) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>
                      {pct == null ? '—' : (
                        <span style={{ color: pct > 0 ? 'var(--red)' : 'var(--green)', fontFamily: 'DM Mono' }}>
                          {pctFmt(pct)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Category Trends tab ───────────────────────────────────────────────────

function CategoryTrends({ months, categories }) {
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState(12);

  // Default: top 6 categories by total spend
  const defaultSelected = useMemo(() => new Set(categories.slice(0, 6).map(c => c.id)), [categories]);
  const activeSet = selected || defaultSelected;

  const visible = categories.filter(c => activeSet.has(c.id));

  const slicedMonths = months.slice(-range);
  const chartData = slicedMonths.map(m => {
    const row = { month: fmtMonth(m) };
    for (const cat of visible) {
      row[cat.name] = cat.monthly.find(d => d.month === m)?.spent || 0;
    }
    return row;
  });

  function toggle(id) {
    const next = new Set(activeSet);
    if (next.has(id)) { if (next.size > 1) next.delete(id); }
    else next.add(id);
    setSelected(next);
  }

  if (!months.length) return <EmptyState icon="📉" title="No category data" subtitle="Import transactions and assign categories" />;

  return (
    <div>
      {/* Category toggles */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={cardTitle}>Categories</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {[6, 12, 18, 24].map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                border: '1px solid', fontFamily: 'inherit',
                borderColor: range === r ? 'var(--accent)' : 'var(--border)',
                background: range === r ? 'var(--accent)15' : 'transparent',
                color: range === r ? 'var(--accent)' : 'var(--text-muted)',
              }}>{r}M</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map(cat => {
            const on = activeSet.has(cat.id);
            return (
              <button key={cat.id} onClick={() => toggle(cat.id)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${cat.color}${on ? '99' : '33'}`,
                background: on ? cat.color + '22' : 'transparent',
                color: on ? cat.color : 'var(--text-dim)',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
                {cat.icon} {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Line chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={cardTitle}>Spending per Category · {range}-Month View</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
            {visible.map(cat => (
              <Line
                key={cat.id}
                type="monotone"
                dataKey={cat.name}
                stroke={cat.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-category summary table */}
      <div className="card">
        <h3 style={cardTitle}>Category Summary · Last {range} Months</h3>
        <table className="table">
          <thead><tr>
            <th>Category</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th style={{ textAlign: 'right' }}>Monthly Avg</th>
            <th style={{ textAlign: 'right' }}>Peak Month</th>
            <th style={{ textAlign: 'right' }}>vs Prior Period</th>
          </tr></thead>
          <tbody>
            {visible.map(cat => {
              const vals = slicedMonths.map(m => cat.monthly.find(d => d.month === m)?.spent || 0);
              const total = vals.reduce((a, b) => a + b, 0);
              const avg = vals.length ? total / vals.filter(v => v > 0).length || 0 : 0;
              const peak = Math.max(...vals);
              const peakMonth = slicedMonths[vals.indexOf(peak)];

              // Compare first half vs second half of the range
              const half = Math.floor(vals.length / 2);
              const firstHalf = vals.slice(0, half).reduce((a, b) => a + b, 0);
              const secondHalf = vals.slice(half).reduce((a, b) => a + b, 0);
              const periodPct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : null;

              return (
                <tr key={cat.id}>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                      {cat.icon} {cat.name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13 }}>{fmt(total)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text-muted)' }}>{fmt(avg)}</td>
                  <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    {peakMonth ? fmtMonth(peakMonth) : '—'}
                    {peak > 0 && <span style={{ fontFamily: 'DM Mono', marginLeft: 4 }}>({fmt(peak)})</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>
                    {periodPct == null ? '—' : (
                      <span style={{ color: periodPct > 0 ? 'var(--red)' : 'var(--green)', fontFamily: 'DM Mono' }}>
                        {pctFmt(periodPct)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Card title style ──────────────────────────────────────────────────────

const cardTitle = {
  fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em',
};

// ─── Main Reporting page ───────────────────────────────────────────────────

const TABS = [
  { id: 'mom', label: 'Month over Month', icon: BarChart2 },
  { id: 'yoy', label: 'Year over Year', icon: GitCompare },
  { id: 'categories', label: 'Category Trends', icon: Layers },
];

export default function Reporting() {
  const [tab, setTab] = useState('mom');
  const [trend, setTrend] = useState([]);
  const [catTrend, setCatTrend] = useState({ months: [], categories: [] });
  const [yoy, setYoy] = useState({ years: [], data: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMonthlyTrend(18),
      api.getCategoryTrend(18),
      api.getYoY(),
    ]).then(([t, ct, y]) => {
      setTrend(t);
      setCatTrend(ct);
      setYoy(y);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const insights = useMemo(
    () => computeInsights(catTrend.months, catTrend.categories),
    [catTrend]
  );

  const lastMonth = catTrend.months[catTrend.months.length - 1];
  const lastMonthLabel = lastMonth ? new Date(lastMonth + '-02').toLocaleString('en', { month: 'long', year: 'numeric' }) : '';

  if (loading) return <Loader text="Loading reports…" />;

  const hasData = trend.length > 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Reporting
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Deep dives into your spending patterns and trends
        </p>
      </div>

      {!hasData ? (
        <EmptyState icon="📊" title="No data yet" subtitle="Import your bank transactions to generate reports" />
      ) : (
        <>
          {/* ── Insights ──────────────────────────────────────── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                🔍 Spending Intelligence
              </div>
              {lastMonthLabel && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px' }}>
                  Based on {lastMonthLabel}
                </span>
              )}
            </div>

            {insights.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13,
              }}>
                <Minus size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Not enough data for insights yet — at least 4 months of transactions needed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {insights.map((item, i) => <InsightCard key={i} item={item} />)}
              </div>
            )}
          </div>

          {/* ── Tabs ──────────────────────────────────────────── */}
          <Tabs value={tab} onChange={setTab} tabs={TABS} />

          {tab === 'mom' && <MonthOverMonth trend={trend} />}
          {tab === 'yoy' && <YearOverYear yoy={yoy} />}
          {tab === 'categories' && (
            <CategoryTrends months={catTrend.months} categories={catTrend.categories} />
          )}
        </>
      )}
    </div>
  );
}
