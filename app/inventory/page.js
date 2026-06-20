'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getProductStock, addInventoryPurchase } from '../../lib/supabase';

function fmt(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_ROW = { item_name: '', quantity: '', unit_cost: '' };

const LOW = 5;

function StockBadge({ current }) {
  if (current === 0)
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Out of stock</span>;
  if (current <= LOW)
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Low — {current} left</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{current} in stock</span>;
}

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all'); // all | low | out
  const [showModal, setShowModal] = useState(false);

  // form state
  const [supplier, setSupplier]   = useState('');
  const [note, setNote]           = useState('');
  const [rows, setRows]           = useState([{ ...EMPTY_ROW }]);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('pos_authed') !== 'true') {
      router.replace('/'); return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await getProductStock();
    setItems(data);
    setLoading(false);
  }

  function openModal() {
    setSupplier(''); setNote(''); setRows([{ ...EMPTY_ROW }]); setFormError('');
    setShowModal(true);
  }

  function updateRow(i, field, val) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  function addRow() { setRows(prev => [...prev, { ...EMPTY_ROW }]); }

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
      supplier, note,
      validRows.map(r => ({
        item_name: r.item_name.trim(),
        quantity: parseInt(r.quantity, 10),
        unit_cost: parseFloat(r.unit_cost || 0),
      }))
    );
    setSaving(false);
    if (success) { setShowModal(false); load(); }
    else setFormError('Failed to save. Please try again.');
  }

  const outCount  = items.filter(i => i.current === 0).length;
  const lowCount  = items.filter(i => i.current > 0 && i.current <= LOW).length;

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'low') return i.current > 0 && i.current <= LOW;
    if (filter === 'out') return i.current === 0;
    return true;
  });

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-brand text-white px-4 sticky top-0 z-40" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: '1rem' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Inventory</h1>
            <p className="text-xs text-white/70 mt-0.5">Purchased − Sold = Current stock</p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-2 rounded-xl"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Add Stock
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 pt-3">
        {[
          { key: 'all',  label: `All (${items.length})` },
          { key: 'low',  label: `Low (${lowCount})` },
          { key: 'out',  label: `Out (${outCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === key
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pt-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
        />
      </div>

      {/* List */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="text-center text-gray-300 py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-300 py-12">
            {search || filter !== 'all' ? 'No products match.' : 'No stock data yet. Add stock or sync the POS.'}
          </div>
        ) : filtered.map((item, i) => (
          <div key={i} className={`bg-white rounded-2xl shadow-sm px-4 py-3 ${item.current === 0 ? 'border-l-4 border-red-400' : item.current <= LOW ? 'border-l-4 border-orange-400' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>+{item.total_in} in</span>
                  <span>−{item.total_sold} sold</span>
                </div>
              </div>
              <div className="shrink-0">
                <StockBadge current={item.current} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <NavBar />

      {/* Add Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Add Stock</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</label>
                  <button onClick={addRow} className="text-xs font-semibold text-brand flex items-center gap-1">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                    </svg>
                    Add row
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-1.5 mb-1 px-1">
                  <span className="col-span-5 text-xs text-gray-400 font-semibold">Product name</span>
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
                        list="product-names"
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
                      <button onClick={() => removeRow(i)} className="col-span-1 flex items-center justify-center text-gray-300 hover:text-red-400">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Datalist for product name autocomplete */}
                <datalist id="product-names">
                  {items.map((item, i) => <option key={i} value={item.name} />)}
                </datalist>
              </div>

              {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white">
              <div>
                <p className="text-xs text-gray-400 font-semibold">Total Cost</p>
                <p className="text-xl font-bold text-gray-800">{fmt(totalCost)}</p>
                <p className="text-xs text-gray-400">{validRows.length} product(s)</p>
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
