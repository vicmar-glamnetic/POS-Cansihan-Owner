'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getInventoryStatus } from '../../lib/supabase';

function fmtDateTime(str) {
  if (!str) return 'Never';
  const d = new Date(str);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + '  ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(str) {
  if (!str) return null;
  const diff = Date.now() - new Date(str).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('pos_authed') !== 'true') {
      router.replace('/'); return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await getInventoryStatus();
    setItems(data);
    setLoading(false);
  }

  const filtered = items.filter(i =>
    !search || i.item_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-brand text-white px-4 sticky top-0 z-40" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: '1rem' }}>
        <h1 className="text-xl font-bold">Inventory</h1>
        <p className="text-xs text-white/70 mt-0.5">Last restock per item</p>
      </div>

      <div className="px-4 pt-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
        />
      </div>

      <div className="px-4 py-3 space-y-2">
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 px-1">{filtered.length} item{filtered.length !== 1 ? 's' : ''} tracked</p>
        )}

        {loading ? (
          <div className="text-center text-gray-300 py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-300 py-12">
            {search ? 'No items match your search.' : 'No stock additions recorded yet.'}
          </div>
        ) : filtered.map((item, i) => {
          const ago = timeAgo(item.last_restocked_at);
          const isRecent = item.last_restocked_at && (Date.now() - new Date(item.last_restocked_at).getTime()) < 86400000;

          return (
            <div key={i} className="bg-white rounded-2xl shadow-sm px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.item_name}</p>
                  {item.last_supplier && (
                    <p className="text-xs text-gray-400 mt-0.5">From: {item.last_supplier}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{fmtDateTime(item.last_restocked_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-700">+{item.last_qty} pcs</p>
                  {ago && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isRecent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ago}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <NavBar />
    </div>
  );
}
