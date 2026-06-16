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

export async function getInventoryStatus() {
  // Fetch all purchase_items joined with their purchase date, sorted newest first
  const { data } = await supabase
    .from('purchase_items')
    .select('item_name, quantity, unit_cost, purchase_id, purchases(created_at, supplier)')
    .order('purchase_id', { ascending: false });

  if (!data) return [];

  // Keep only the most recent entry per item_name
  const seen = new Set();
  const result = [];
  for (const row of data) {
    if (!seen.has(row.item_name)) {
      seen.add(row.item_name);
      result.push({
        item_name: row.item_name,
        last_qty: row.quantity,
        last_unit_cost: row.unit_cost,
        last_restocked_at: row.purchases?.created_at || null,
        last_supplier: row.purchases?.supplier || '',
      });
    }
  }

  // Sort by most recently restocked
  return result.sort((a, b) => {
    if (!a.last_restocked_at) return 1;
    if (!b.last_restocked_at) return -1;
    return b.last_restocked_at.localeCompare(a.last_restocked_at);
  });
}
