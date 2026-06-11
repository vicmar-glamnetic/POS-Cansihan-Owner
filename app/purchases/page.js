'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getPurchases, getPurchaseItems } from '../../lib/supabase';

function fmt(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + '  ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);
  const [itemsCache, setItemsCache] = useState({});

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('pos_authed') !== 'true') {
      router.replace('/'); return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await getPurchases(200);
    setPurchases(data);
    setLoading(false);
  }

  async function toggleExpand(purchase) {
    if (expanded === purchase.id) { setExpanded(null); return; }
    setExpanded(purchase.id);
    if (!itemsCache[purchase.id]) {
      const items = await getPurchaseItems(purchase.id);
      setItemsCache(c => ({ ...c, [purchase.id]: items }));
    }
  }

  const totalSpent = purchases.reduce((s, p) => s + p.total_cost, 0);

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-brand text-white px-4 pt-12 pb-4 sticky top-0 z-40" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold">Purchase Log</h1>
      </div>

      <div className="px-4 py-3 space-y-2">
        {!loading && purchases.length > 0 && (
          <div className="flex justify-between text-sm text-gray-500 px-1">
            <span>{purchases.length} purchase{purchases.length !== 1 ? 's' : ''}</span>
            <span className="font-bold text-gray-800">Total: {fmt(totalSpent)}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-300 py-12">Loading…</div>
        ) : purchases.length === 0 ? (
          <div className="text-center text-gray-300 py-12">No purchases logged yet.</div>
        ) : purchases.map(p => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              className="w-full flex items-start justify-between px-4 py-3 text-left"
              onClick={() => toggleExpand(p)}
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">{fmtDateTime(p.created_at)}</p>
                {p.supplier && <p className="text-xs text-gray-400 mt-0.5">From: {p.supplier}</p>}
                {p.note && <p className="text-xs text-gray-400 italic mt-0.5">{p.note}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-base font-extrabold text-gray-700">{fmt(p.total_cost)}</span>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-300 transition-transform ${expanded === p.id ? 'rotate-180' : ''}`}>
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </button>

            {expanded === p.id && (
              <div className="border-t border-gray-50 px-4 pb-4 pt-2 bg-gray-50 space-y-1.5">
                {(itemsCache[p.id] || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.item_name} <span className="text-gray-400">×{item.quantity}</span></span>
                    <span className="font-medium text-gray-700">{fmt(item.unit_cost * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200">
                  <span>Total Cost</span>
                  <span>{fmt(p.total_cost)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <NavBar />
    </div>
  );
}
