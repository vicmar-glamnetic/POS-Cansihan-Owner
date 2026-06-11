'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getOrders, getOrderItems } from '../../lib/supabase';

function fmt(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + '  ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [dateFrom, setDateFrom]       = useState(todayStr());
  const [dateTo, setDateTo]           = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded]       = useState(null);
  const [itemsCache, setItemsCache]   = useState({});

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('pos_authed') !== 'true') {
      router.replace('/'); return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await getOrders({ dateFrom, dateTo, status: statusFilter || undefined, limit: 200 });
    setOrders(data);
    setLoading(false);
  }

  async function toggleExpand(order) {
    if (expanded === order.id) { setExpanded(null); return; }
    setExpanded(order.id);
    if (!itemsCache[order.id]) {
      const items = await getOrderItems(order.id);
      setItemsCache(c => ({ ...c, [order.id]: items }));
    }
  }

  const totalSales = orders.filter(o => o.status !== 'voided').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-brand text-white px-4 pt-12 pb-4 sticky top-0 z-40" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold">Orders</h1>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2 sticky top-[calc(env(safe-area-inset-top)+72px)] z-30">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 font-medium">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 font-medium">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50"
            />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {[
              { v: '', l: 'All' },
              { v: 'completed', l: 'Completed' },
              { v: 'voided', l: 'Voided' },
            ].map(s => (
              <button
                key={s.v}
                onClick={() => setStatusFilter(s.v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${statusFilter === s.v ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {s.l}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="ml-auto bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-semibold"
          >
            Search
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Summary row */}
        {!loading && orders.length > 0 && (
          <div className="flex justify-between text-sm text-gray-500 px-1">
            <span>{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
            <span className="font-bold text-gray-800">{fmt(totalSales)}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-300 py-12">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-300 py-12">No orders found.</div>
        ) : orders.map(order => (
          <div
            key={order.id}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden ${order.status === 'voided' ? 'opacity-60' : ''}`}
          >
            {/* Order header row */}
            <button
              className="w-full flex items-start justify-between px-4 py-3 text-left"
              onClick={() => toggleExpand(order)}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{fmtDateTime(order.created_at)}</span>
                  {order.status === 'voided' && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">VOIDED</span>
                  )}
                </div>
                {order.table_name && (
                  <p className="text-xs text-gray-400 mt-0.5">{order.table_name}</p>
                )}
                {order.note && (
                  <p className="text-xs text-gray-400 italic mt-0.5">{order.note}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className={`text-base font-extrabold ${order.status === 'voided' ? 'line-through text-gray-400' : 'text-brand'}`}>
                  {fmt(order.total_amount)}
                </span>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-300 transition-transform ${expanded === order.id ? 'rotate-180' : ''}`}>
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </button>

            {/* Expanded items */}
            {expanded === order.id && (
              <div className="border-t border-gray-50 px-4 pb-4 pt-2 bg-gray-50 space-y-1.5">
                {(itemsCache[order.id] || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.menu_item_name} <span className="text-gray-400">×{item.quantity}</span></span>
                    <span className="font-medium text-gray-700">{fmt(item.price * item.quantity)}</span>
                  </div>
                ))}
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                    <span className="text-green-600">{order.discount_label || 'Discount'}</span>
                    <span className="text-green-600 font-medium">-{fmt(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-brand">{fmt(order.total_amount)}</span>
                </div>
                {order.amount_tendered > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Tendered / Change</span>
                    <span>{fmt(order.amount_tendered)} / {fmt(order.change_amount)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <NavBar />
    </div>
  );
}
