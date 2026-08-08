// Food orders repository — D1 data access layer for food_orders + food_order_items.
// CRITICAL: Order totals are calculated server-side from authoritative menu prices.

import type { MenuItem } from "./menuRepo.js";

export interface FoodOrderItemRow {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  food_cost: number;
  created_at: string;
}

export interface FoodOrderItem {
  id: string;
  tenantId: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  foodCost: number;
  createdAt: string;
}

export interface FoodOrderRow {
  id: string;
  tenant_id: string;
  reference: string;
  guest_name: string;
  guest_phone: string;
  total: number;
  total_cost: number;
  status: string;
  notes: string;
  created_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

export interface FoodOrder {
  id: string;
  tenantId: string;
  reference: string;
  guestName: string;
  guestPhone: string;
  items: FoodOrderItem[];
  total: number;
  totalCost: number;
  status: string;
  notes: string;
  createdAt: string;
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
}

function rowToOrderItem(row: FoodOrderItemRow): FoodOrderItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    name: row.name,
    quantity: row.quantity,
    price: row.price,
    foodCost: row.food_cost,
    createdAt: row.created_at,
  };
}

function rowToOrder(row: FoodOrderRow, items: FoodOrderItem[]): FoodOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reference: row.reference,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    items,
    total: row.total,
    totalCost: row.total_cost,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    preparingAt: row.preparing_at,
    readyAt: row.ready_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateFoodOrderInput {
  guestName: string;
  guestPhone?: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }>;
}

export async function createFoodOrder(
  db: D1Database,
  tenantId: string,
  input: CreateFoodOrderInput,
  menuItems: MenuItem[],
): Promise<FoodOrder> {
  const orderId = crypto.randomUUID();
  const reference = "FO-" + Date.now().toString(36).toUpperCase();

  // Calculate totals server-side from authoritative menu prices
  let total = 0;
  let totalCost = 0;
  const orderItems: Array<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    foodCost: number;
  }> = [];

  for (const inputItem of input.items) {
    const menuItem = menuItems.find((m) => m.id === inputItem.menuItemId);
    if (!menuItem) {
      throw new Error(`Menu item not found: ${inputItem.menuItemId}`);
    }
    if (!menuItem.active) {
      throw new Error(`Menu item unavailable: ${menuItem.name}`);
    }
    if (inputItem.quantity <= 0) {
      throw new Error(`Invalid quantity for ${menuItem.name}: ${inputItem.quantity}`);
    }
    if (inputItem.quantity > 100) {
      throw new Error(`Excessive quantity for ${menuItem.name}: ${inputItem.quantity}`);
    }

    const lineTotal = menuItem.price * inputItem.quantity;
    const lineCost = menuItem.foodCost * inputItem.quantity;
    total += lineTotal;
    totalCost += lineCost;

    orderItems.push({
      id: crypto.randomUUID(),
      menuItemId: inputItem.menuItemId,
      name: menuItem.name,
      quantity: inputItem.quantity,
      price: menuItem.price,
      foodCost: menuItem.foodCost,
    });
  }

  // Create order
  await db
    .prepare(
      `INSERT INTO food_orders (id, tenant_id, reference, guest_name, guest_phone, total, total_cost, status, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8)`,
    )
    .bind(orderId, tenantId, reference, input.guestName, input.guestPhone ?? "", total, totalCost, input.notes ?? "")
    .run();

  // Create order items
  const stmt = db.prepare(
    `INSERT INTO food_order_items (id, tenant_id, order_id, menu_item_id, name, quantity, price, food_cost)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  );
  const batches = orderItems.map((item) =>
    stmt.bind(item.id, tenantId, orderId, item.menuItemId, item.name, item.quantity, item.price, item.foodCost),
  );
  await db.batch(batches);

  return getOrder(db, tenantId, orderId);
}

export async function getOrder(
  db: D1Database,
  tenantId: string,
  orderId: string,
): Promise<FoodOrder> {
  const row = await db
    .prepare("SELECT * FROM food_orders WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, orderId)
    .first<FoodOrderRow>();
  if (!row) return null as unknown as FoodOrder;

  const itemsResult = await db
    .prepare("SELECT * FROM food_order_items WHERE order_id = ?1")
    .bind(orderId)
    .all<FoodOrderItemRow>();

  return rowToOrder(row, (itemsResult.results ?? []).map(rowToOrderItem));
}

export async function listOrders(
  db: D1Database,
  tenantId: string,
  filters?: { status?: string; limit?: number },
): Promise<FoodOrder[]> {
  let query = "SELECT * FROM food_orders WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];

  if (filters?.status) {
    query += " AND status = ?2";
    params.push(filters.status);
  }

  query += " ORDER BY created_at DESC";

  if (filters?.limit) {
    const idx = params.length + 1;
    query += ` LIMIT ?${idx}`;
    params.push(filters.limit);
  }

  const result = await db.prepare(query).bind(...params).all<FoodOrderRow>();
  const orders: FoodOrder[] = [];

  for (const row of result.results ?? []) {
    const itemsResult = await db
      .prepare("SELECT * FROM food_order_items WHERE order_id = ?1")
      .bind(row.id)
      .all<FoodOrderItemRow>();
    orders.push(rowToOrder(row, (itemsResult.results ?? []).map(rowToOrderItem)));
  }

  return orders;
}

export async function updateOrderStatus(
  db: D1Database,
  tenantId: string,
  orderId: string,
  status: string,
): Promise<FoodOrder | null> {
  const validTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
  };

  const current = await db
    .prepare("SELECT status FROM food_orders WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, orderId)
    .first<{ status: string }>();

  if (!current) return null;

  const allowed = validTransitions[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid status transition: ${current.status} → ${status}`);
  }

  const now = new Date().toISOString();
  let timestampUpdate = "";
  if (status === "confirmed") timestampUpdate = ", confirmed_at = '" + now + "'";
  else if (status === "preparing") timestampUpdate = ", preparing_at = '" + now + "'";
  else if (status === "ready") timestampUpdate = ", ready_at = '" + now + "'";
  else if (status === "delivered") timestampUpdate = ", delivered_at = '" + now + "'";
  else if (status === "cancelled") timestampUpdate = ", cancelled_at = '" + now + "'";

  await db
    .prepare(
      `UPDATE food_orders
       SET status = ?1, updated_at = datetime('now')${timestampUpdate}
       WHERE tenant_id = ?2 AND id = ?3`,
    )
    .bind(status, tenantId, orderId)
    .run();

  return getOrder(db, tenantId, orderId);
}
