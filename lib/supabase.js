import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function getAdminPin() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'admin_pin')
    .single();
  return data?.value || '1234';
}

export async function updateAdminPin(newPin) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'admin_pin', value: newPin });
  return !error;
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7) + '-01';

  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount, status, created_at, discount_amount')
    .order('created_at', { ascending: false });

  if (!orders) return null;

  const completed = orders.filter(o => o.status === 'completed' || !o.status);
  const voided    = orders.filter(o => o.status === 'voided');

  const todaySales   = completed.filter(o => o.created_at?.startsWith(todayStr));
  const monthSales   = completed.filter(o => o.created_at >= monthStr);

  return {
    todayTotal:   todaySales.reduce((s, o) => s + o.total_amount, 0),
    todayOrders:  todaySales.length,
    monthTotal:   monthSales.reduce((s, o) => s + o.total_amount, 0),
    monthOrders:  monthSales.length,
    allTotal:     completed.reduce((s, o) => s + o.total_amount, 0),
    allOrders:    completed.length,
    voidedCount:  voided.length,
  };
}

export async function getDailySales(days = 30) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString();

  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount, status, created_at')
    .gte('created_at', fromStr)
    .in('status', ['completed', null])
    .order('created_at', { ascending: true });

  if (!orders) return [];

  // Group by date
  const map = {};
  for (const o of orders) {
    if (o.status === 'voided') continue;
    const date = o.created_at?.substring(0, 10);
    if (!date) continue;
    if (!map[date]) map[date] = { date, total: 0, orders: 0 };
    map[date].total += o.total_amount;
    map[date].orders += 1;
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getBestSellers(days = 30) {
  const from = new Date();
  from.setDate(from.getDate() - days);

  // Get completed order IDs in range
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .gte('created_at', from.toISOString())
    .neq('status', 'voided');

  if (!orders || orders.length === 0) return [];
  const orderIds = orders.map(o => o.id);

  const { data: items } = await supabase
    .from('order_items')
    .select('menu_item_name, quantity, price')
    .in('order_id', orderIds);

  if (!items) return [];

  const map = {};
  for (const item of items) {
    const n = item.menu_item_name;
    if (!map[n]) map[n] = { name: n, qty: 0, revenue: 0 };
    map[n].qty += item.quantity;
    map[n].revenue += item.quantity * item.price;
  }

  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 8);
}

export async function getOrders({ dateFrom, dateTo, status, limit = 100 } = {}) {
  let query = supabase
    .from('orders')
    .select('id, total_amount, subtotal, discount_amount, discount_label, amount_tendered, change_amount, table_name, note, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59');
  if (status)   query = query.eq('status', status);

  const { data } = await query;
  return data || [];
}

export async function getOrderItems(orderId) {
  const { data } = await supabase
    .from('order_items')
    .select('menu_item_name, price, quantity')
    .eq('order_id', orderId);
  return data || [];
}

export async function getPurchases(limit = 100) {
  const { data } = await supabase
    .from('purchases')
    .select('id, supplier, note, total_cost, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getPurchaseItems(purchaseId) {
  const { data } = await supabase
    .from('purchase_items')
    .select('item_name, quantity, unit_cost')
    .eq('purchase_id', purchaseId);
  return data || [];
}

export async function getProductStock() {
  const [{ data: purchased }, { data: soldData }, { data: adjustments }] = await Promise.all([
    supabase.from('purchase_items').select('item_name, quantity'),
    supabase.from('order_items').select('menu_item_name, quantity, orders!inner(status)'),
    supabase.from('stock_adjustments').select('item_name, adjustment'),
  ]);

  const sold = (soldData || []).filter(i => i.orders?.status !== 'voided');
  const map = {};

  for (const row of (purchased || [])) {
    const n = row.item_name;
    if (!map[n]) map[n] = { name: n, total_in: 0, total_sold: 0, adjustment: 0 };
    map[n].total_in += row.quantity;
  }
  for (const row of sold) {
    const n = row.menu_item_name;
    if (!map[n]) map[n] = { name: n, total_in: 0, total_sold: 0, adjustment: 0 };
    map[n].total_sold += row.quantity;
  }
  for (const row of (adjustments || [])) {
    const n = row.item_name;
    if (!map[n]) map[n] = { name: n, total_in: 0, total_sold: 0, adjustment: 0 };
    map[n].adjustment += row.adjustment;
  }

  return Object.values(map)
    .map(item => ({ ...item, current: Math.max(0, item.total_in - item.total_sold + item.adjustment) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setProductStock(itemName, newStock, currentStock) {
  const adjustment = newStock - currentStock;
  const { error } = await supabase
    .from('stock_adjustments')
    .insert({ item_name: itemName, adjustment, note: 'Manual adjustment by admin' });
  return !error;
}

export async function addInventoryPurchase(supplier, note, items) {
  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({ supplier: supplier.trim(), note: note.trim(), total_cost: totalCost })
    .select()
    .single();

  if (error || !purchase) return { success: false, error };

  const { error: itemsError } = await supabase
    .from('purchase_items')
    .insert(items.map(i => ({
      purchase_id: purchase.id,
      item_name: i.item_name.trim(),
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    })));

  return { success: !itemsError, error: itemsError };
}
