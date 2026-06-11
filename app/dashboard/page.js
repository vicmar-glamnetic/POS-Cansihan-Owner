'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import NavBar from '../../components/NavBar';
import { getDashboardStats, getDailySales, getBestSellers } from '../../lib/supabase';

const RANGES = [
  { key: 7,  label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
];

function fmt(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n) {
  if (n >= 1000000) return '₱' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '₱' + (n / 1000).toFixed(1) + 'k';
  return '₱' + Math.round(n);
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm ${accent ? 'border-t-4 border-brand' : ''}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-extrabold ${accent ? 'text-brand' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-600 mb-1">{shortDate(label)}</p>
      <p className="text-brand font-bold">{fmt(payload[0]?.value)}</p>
      <p className="text-gray-400">{payload[1]?.value} orders</p>
    </div>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats]         = useState(null);
  const [daily, setDaily]         = useState([]);
  const [sellers, setSellers]     = useState([]);
  const [range, setRange]         = useState(30);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('pos_authed') !== 'true') {
      router.replace('/');
      return;
    }
    load(range);
  }, []);

  async function load(days) {
    setLoading(true);
    const [s, d, bs] = await Promise.all([
      getDashboardStats(),
      getDailySales(days),
      getBestSellers(days),
    ]);
    setStats(s);
    setDaily(d);
    setSellers(bs);
    setLoading(false);
  }

  function handleRange(r) {
    setRange(r);
    load(r);
  }

  const maxBar = daily.length ? Math.max(...daily.map(d => d.total)) : 1;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-brand text-white px-4 pt-12 pb-5 sticky top-0 z-40" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold">Sales Dashboard</h1>
        <p className="text-orange-100 text-sm">{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-300">Loading…</div>
        ) : !stats ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">
            Could not load data. Check your Supabase credentials in <code>.env.local</code>.
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Today" value={fmt(stats.todayTotal)} sub={`${stats.todayOrders} orders`} accent />
              <StatCard label="This Month" value={fmt(stats.monthTotal)} sub={`${stats.monthOrders} orders`} />
              <StatCard label="All Time" value={fmtShort(stats.allTotal)} sub={`${stats.allOrders} completed`} />
              <StatCard label="Voided" value={stats.voidedCount} sub="total voided orders" />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-700">Daily Sales</h2>
                <div className="flex gap-1">
                  {RANGES.map(r => (
                    <button
                      key={r.key}
                      onClick={() => handleRange(r.key)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${range === r.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {daily.length === 0 ? (
                <p className="text-center text-gray-300 py-8 text-sm">No sales in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      interval="preserveStartEnd"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="total" radius={[4,4,0,0]}>
                      {daily.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.total === maxBar ? '#e8521a' : '#fed7c3'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Best sellers */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-3">Best Sellers</h2>
              {sellers.length === 0 ? (
                <p className="text-center text-gray-300 py-4 text-sm">No data.</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const maxQty = sellers[0]?.qty || 1;
                    return sellers.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-300 w-4">#{i+1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="font-medium text-gray-700 truncate">{item.name}</span>
                            <span className="text-gray-400 text-xs ml-2 shrink-0">{item.qty} sold</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand rounded-full"
                              style={{ width: `${(item.qty / maxQty) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-16 text-right">{fmtShort(item.revenue)}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <NavBar />
    </div>
  );
}
