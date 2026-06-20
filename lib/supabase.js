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
  // purchase_items.quantity can be negative (admin correction records)
  const [menuRes, purchasedRes, soldRes] = await Promise.all([
    // No is_available filter — show all synced items (matches POS app inventory screen)
    // Try to get stock column; if it doesn't exist yet, menuRes.error will be set
    supabase.from('menu_items').select('name, stock'),
    supabase.from('purchase_items').select('item_name, quantity'),
    supabase.from('order_items').select('menu_item_name, quantity, orders!inner(status)'),
  ]);

  // If stock column missing, retry with just name
  const menuData = menuRes.error
    ? (await supabase.from('menu_items').select('name')).data
    : menuRes.data;

  const sold = (soldRes.data || []).filter(i => i.orders?.status !== 'voided');
  const map = {};

  if (menuData && menuData.length > 0) {
    // Use synced menu_items as the exact product list (matches POS app)
    // stock: -1 = unlimited, >=0 = exact count from POS app, null = not yet synced
    for (const item of menuData) {
      const appStock = item.stock != null ? item.stock : null;
      map[item.name] = { name: item.name, total_in: 0, total_sold: 0, app_stock: appStock };
    }
    for (const row of (purchasedRes.data || [])) {
      if (map[row.item_name]) map[row.item_name].total_in += row.quantity;
    }
    for (const row of sold) {
      if (map[row.menu_item_name]) map[row.menu_item_name].total_sold += row.quantity;
    }
  } else {
    // menu_items not synced yet — derive product list from order + purchase history
    for (const row of (purchasedRes.data || [])) {
      const n = row.item_name;
      if (!map[n]) map[n] = { name: n, total_in: 0, total_sold: 0, app_stock: null };
      map[n].total_in += row.quantity;
    }
    for (const row of sold) {
      const n = row.menu_item_name;
      if (!map[n]) map[n] = { name: n, total_in: 0, total_sold: 0, app_stock: null };
      map[n].total_sold += row.quantity;
    }
  }

  return Object.values(map)
    .map(item => ({
      ...item,
      // app_stock -1 = unlimited; >=0 = use directly; null = fall back to calculated
      current: item.app_stock === -1 ? -1 : (item.app_stock != null ? item.app_stock : Math.max(0, item.total_in - item.total_sold)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setProductStock(itemName, newStock, currentStock) {
  const delta = newStock - currentStock;
  if (delta === 0) return true;

  // Store as a correction purchase (no new table needed)
  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({
      local_id: null,
      supplier: 'Admin Correction',
      note: `Stock set to ${newStock} (was ${currentStock})`,
      total_cost: 0,
    })
    .select()
    .single();

  if (error || !purchase) return false;

  const { error: itemError } = await supabase
    .from('purchase_items')
    .insert({
      purchase_id: purchase.id,
      item_name: itemName,
      quantity: delta,  // negative if reducing
      unit_cost: 0,
    });

  return !itemError;
}

export async function addInventoryPurchase(supplier, note, items) {
  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  // local_id is null when added from the web dashboard (not from POS device)
  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({
      local_id: null,
      supplier: (supplier || '').trim(),
      note: (note || '').trim(),
      total_cost: totalCost,
    })
    .select()
    .single();

  if (error || !purchase) return { success: false, error: error?.message || 'Insert failed' };

  const { error: itemsError } = await supabase
    .from('purchase_items')
    .insert(items.map(i => ({
      purchase_id: purchase.id,
      item_name: (i.item_name || '').trim(),
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    })));

  return { success: !itemsError, error: itemsError?.message };
}

export async function deleteProductFromInventory(itemName) {
  // Snapshot purchase_items so we can undo
  const { data: snapshot } = await supabase
    .from('purchase_items')
    .select('purchase_id, item_name, quantity, unit_cost')
    .eq('item_name', itemName);

  // Write to activity log (graceful — if table doesn't exist yet, deletion still proceeds)
  try {
    await supabase.from('activity_log').insert({
      action: 'product_deleted',
      item_name: itemName,
      details: JSON.stringify(snapshot || []),
      performed_by: 'admin',
    });
  } catch {}

  await supabase.from('purchase_items').delete().eq('item_name', itemName);
  return true;
}

export async function getRecentActivity(limit = 10) {
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function undoProductDelete(logEntry) {
  try {
    const items = JSON.parse(logEntry.details || '[]');
    if (items.length > 0) {
      await supabase.from('purchase_items').insert(items);
    }
    await supabase.from('activity_log').delete().eq('id', logEntry.id);
    return true;
  } catch {
    return false;
  }
}
