'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getInventoryStatus, addInventoryPurchase } from '../../lib/supabase';

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

function fmt(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_ROW = { item_name: '', quantity: '', unit_cost: '' };

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);

  // form state
  const [supplier, setSupplier] = useState('');
  const [note, setNote]         = useState('');
  const [rows, setRows]         = useState([{ ...EMPTY_ROW }]);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

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

  function openModal() {
    setSupplier('');
    setNote('');
    setRows([{ ...EMPTY_ROW }]);
    setFormError('');
    setShowModal(true);
  }

  function updateRow(i, field, val) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  function addRow() {
    setRows(prev => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(i) {
    setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));
  }

  const validRows = rows.filter(r => r.item_name.trim() && parseInt(r.quantity, 10) > 0);
  const totalCost = validRows.reduce((s, r) => s + parseInt(r.quantity, 10) * parseFloat(r.unit_cost || 0), 0);

  async function handleSave() {
    if (validRows.length === 0) { setFormError('Add at least one item with a name and quantity.'); return; }
    setFormError('');
    setSaving(true);
    const { success } = await addInventoryPurchase(
      supplier,
      note,
      validRows.map(r => ({
        item_name: r.item_name.trim(),
        quantity: parseInt(r.quantity, 10),
        unit_cost: parseFloat(r.unit_cost || 0),
      }))
    );
    setSaving(false);
    if (success) {
      setShowModal(false);
      load();
    } else {
      setFormError('Failed to save. Please try again.');
    }
  }

  const filtered = items.filter(i =>
    !search || i.item_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-brand text-white px-4 sticky top-0 z-40" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: '1rem' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Inventory</h1>
            <p className="text-xs text-white/70 mt-0.5">Last restock per item</p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Log Stock
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
        />
      </div>

      {/* List */}
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
          const byAdmin = item.added_by === 'admin';

          return (
            <div key={i} className="bg-white rounded-2xl shadow-sm px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{item.item_name}</p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${byAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {byAdmin ? 'by Admin' : 'by POS'}
                    </span>
                  </div>
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

      {/* Log Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Log Stock Addition</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Supplier */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier (optional)</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="e.g. Ang Tirahan Grocery"
                  className="mt-1.5 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Weekly restock"
                  className="mt-1.5 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</label>
                  <button onClick={addRow} className="text-xs font-semibold text-brand flex items-center gap-1">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                    </svg>
                    Add item
                  </button>
                </div>

                {/* Column labels */}
                <div className="grid grid-cols-12 gap-1.5 mb-1 px-1">
                  <span className="col-span-5 text-xs text-gray-400 font-semibold">Item name</span>
                  <span className="col-span-3 text-xs text-gray-400 font-semibold text-center">Qty</span>
                  <span className="col-span-3 text-xs text-gray-400 font-semibold text-center">Unit cost</span>
                  <span className="col-span-1" />
                </div>

                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        value={row.item_name}
                        onChange={e => updateRow(i, 'item_name', e.target.value)}
                        placeholder="Name"
                        className="col-span-5 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-brand"
                      />
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={e => updateRow(i, 'quantity', e.target.value)}
                        placeholder="0"
                        min="1"
                        className="col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-brand"
                      />
                      <input
                        type="number"
                        value={row.unit_cost}
                        onChange={e => updateRow(i, 'unit_cost', e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-brand"
                      />
                      <button
                        onClick={() => removeRow(i)}
                        className="col-span-1 flex items-center justify-center text-gray-300 hover:text-red-400"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-500 font-medium">{formError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white">
              <div>
                <p className="text-xs text-gray-400 font-semibold">Total Cost</p>
                <p className="text-xl font-bold text-gray-800">{fmt(totalCost)}</p>
                <p className="text-xs text-gray-400">{validRows.length} item(s)</p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-brand text-white font-bold px-6 py-3.5 rounded-2xl disabled:opacity-50 text-sm"
              >
                {saving ? 'Saving…' : (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
