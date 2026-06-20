'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getProductStock, addInventoryPurchase, setProductStock, deleteProductFromInventory } from '../../lib/supabase';

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

// ── Confirm Delete Dialog ────────────────────────────────────────────────────
function ConfirmDialog({ item, onConfirm, onCancel }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-base font-bold text-gray-800 mb-1">Remove from Inventory?</h3>
        <p className="text-sm text-gray-500 mb-5">
          This will remove all stock records for <span className="font-semibold text-gray-700">"{item.name}"</span>.
          Sales history is kept. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Stock Modal ──────────────────────────────────────────────────────────
function AddStockModal({ visible, items, onClose, onSaved }) {
  const [supplier, setSupplier] = useState('');
  const [note, setNote]         = useState('');
  const [rows, setRows]         = useState([{ ...EMPTY_ROW }]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (visible) { setSupplier(''); setNote(''); setRows([{ ...EMPTY_ROW }]); setError(''); }
  }, [visible]);

  function updateRow(i, field, val) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }
  function addRow() { setRows(prev => [...prev, { ...EMPTY_ROW }]); }
  function removeRow(i) { setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)); }

  const validRows = rows.filter(r => r.item_name.trim() && parseInt(r.quantity, 10) > 0);
  const totalCost = validRows.reduce((s, r) => s + parseInt(r.quantity, 10) * parseFloat(r.unit_cost || 0), 0);

  async function handleSave() {
    if (validRows.length === 0) { setError('Add at least one product with a name and quantity.'); return; }
    setError('');
    setSaving(true);
    const result = await addInventoryPurchase(supplier, note, validRows.map(r => ({
      item_name: r.item_name.trim(),
      quantity: parseInt(r.quantity, 10),
      unit_cost: parseFloat(r.unit_cost || 0),
    })));
    setSaving(false);
    if (result.success) { onSaved(); }
    else setError(result.error || 'Failed to save. Please try again.');
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Add Stock</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier (optional)</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="e.g. Ang Tirahan Grocery"
              className="mt-1.5 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Weekly restock"
              className="mt-1.5 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</label>
              <button onClick={addRow} className="flex items-center gap-1 text-xs font-semibold text-brand">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                </svg>
                Add row
              </button>
            </div>

            <div className="grid grid-cols-12 gap-1.5 mb-1 px-0.5">
              <span className="col-span-5 text-xs text-gray-400 font-semibold">Product name</span>
              <span className="col-span-3 text-xs text-gray-400 font-semibold text-center">Qty</span>
              <span className="col-span-3 text-xs text-gray-400 font-semibold text-center">Unit cost</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <input type="text" value={row.item_name} onChange={e => updateRow(i, 'item_name', e.target.value)}
                    placeholder="Name" list="product-names"
                    className="col-span-5 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-brand" />
                  <input type="number" value={row.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)}
                    placeholder="0" min="1"
                    className="col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-brand" />
                  <input type="number" value={row.unit_cost} onChange={e => updateRow(i, 'unit_cost', e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    className="col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-brand" />
                  <button onClick={() => removeRow(i)} className="col-span-1 flex items-center justify-center text-gray-300 hover:text-red-400">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <datalist id="product-names">
              {items.map((item, i) => <option key={i} value={item.name} />)}
            </datalist>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white">
          <div>
            <p className="text-xs text-gray-400 font-semibold">Total Cost</p>
            <p className="text-xl font-bold text-gray-800">{fmt(totalCost)}</p>
            <p className="text-xs text-gray-400">{validRows.length} product(s)</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-brand text-white font-bold px-6 py-3.5 rounded-2xl disabled:opacity-60 text-sm active:scale-95 transition-transform">
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Saving…
              </span>
            ) : 'Save Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all');
  const [showModal, setShowModal]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  // inline edit
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue]     = useState('');
  const [savingEdit, setSavingEdit]   = useState(false);
  const editRef = useRef(null);

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

  // ── Inline edit ────────────────────────────────────────────────────────────
  function startEdit(item) {
    setEditingName(item.name);
    setEditValue(String(item.current));
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function cancelEdit() { setEditingName(null); setEditValue(''); }

  async function confirmEdit(item) {
    const newStock = parseInt(editValue, 10);
    if (isNaN(newStock) || newStock < 0) { cancelEdit(); return; }
    if (newStock === item.current) { cancelEdit(); return; }
    setSavingEdit(true);
    const ok = await setProductStock(item.name, newStock, item.current);
    setSavingEdit(false);
    if (ok) setItems(prev => prev.map(i => i.name === item.name ? { ...i, current: newStock } : i));
    setEditingName(null);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteProductFromInventory(deleteTarget.name);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  const outCount = items.filter(i => i.current === 0).length;
  const lowCount = items.filter(i => i.current > 0 && i.current <= LOW).length;

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'low') return i.current > 0 && i.current <= LOW;
    if (filter === 'out') return i.current === 0;
    return true;
  });

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-brand text-white px-4 sticky top-0 z-40"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: '1rem' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Inventory</h1>
            <p className="text-xs text-white/70 mt-0.5">Tap stock count to edit</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-2 rounded-xl">
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
          { key: 'all', label: `All (${items.length})` },
          { key: 'low', label: `Low (${lowCount})` },
          { key: 'out', label: `Out (${outCount})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === key ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pt-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand" />
      </div>

      {/* List */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="text-center text-gray-300 py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-300 py-12">
            {search || filter !== 'all' ? 'No products match.' : 'No stock data yet. Tap "Add Stock" to get started.'}
          </div>
        ) : filtered.map(item => {
          const isEditing = editingName === item.name;
          return (
            <div key={item.name}
              className={`bg-white rounded-2xl shadow-sm px-4 py-3 ${
                item.current === 0 ? 'border-l-4 border-red-400' :
                item.current <= LOW ? 'border-l-4 border-orange-400' : ''
              }`}>
              <div className="flex items-center gap-3">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>+{item.total_in} in</span>
                    <span>−{item.total_sold} sold</span>
                    {item.adjustment !== 0 && (
                      <span className={item.adjustment > 0 ? 'text-purple-500' : 'text-orange-500'}>
                        {item.adjustment > 0 ? `+${item.adjustment}` : item.adjustment} adj
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock edit */}
                {isEditing ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input ref={editRef} type="number" min="0" value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmEdit(item); if (e.key === 'Escape') cancelEdit(); }}
                      className="w-16 border-2 border-brand rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none" />
                    <button onClick={() => confirmEdit(item)} disabled={savingEdit}
                      className="text-xs font-bold text-white bg-brand px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                      {savingEdit ? '…' : 'OK'}
                    </button>
                    <button onClick={cancelEdit} className="text-xs text-gray-400 px-1 py-1.5">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(item)} className="flex items-center gap-1 group">
                      <StockBadge current={item.current} />
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button onClick={() => setDeleteTarget(item)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NavBar />

      {/* Add Stock popup */}
      <AddStockModal
        visible={showModal}
        items={items}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); load(); }}
      />

      {/* Confirm delete dialog */}
      <ConfirmDialog
        item={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {deleting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl px-6 py-4 text-sm font-semibold text-gray-600">Removing…</div>
        </div>
      )}
    </div>
  );
}
