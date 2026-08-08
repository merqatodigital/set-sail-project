// Menu items repository — D1 data access layer for menu_items.
// CRITICAL: Prices are authoritative server-side only.

export interface MenuItemRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  food_cost: number;
  inventory_count: number;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  foodCost: number;
  inventoryCount: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function rowToItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    foodCost: row.food_cost,
    inventoryCount: row.inventory_count,
    active: row.active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMenuItems(
  db: D1Database,
  tenantId: string,
  options?: { activeOnly?: boolean; category?: string },
): Promise<MenuItem[]> {
  let query = "SELECT * FROM menu_items WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];

  if (options?.activeOnly) {
    query += " AND active = 1";
  }
  if (options?.category) {
    query += " AND category = ?2";
    params.push(options.category);
  }

  query += " ORDER BY sort_order, name";

  const result = await db.prepare(query).bind(...params).all<MenuItemRow>();
  return (result.results ?? []).map(rowToItem);
}

export async function getMenuItem(
  db: D1Database,
  tenantId: string,
  itemId: string,
): Promise<MenuItem | null> {
  const row = await db
    .prepare("SELECT * FROM menu_items WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, itemId)
    .first<MenuItemRow>();
  return row ? rowToItem(row) : null;
}

export async function createMenuItem(
  db: D1Database,
  tenantId: string,
  input: {
    name: string;
    description?: string;
    category?: string;
    price: number;
    foodCost?: number;
    inventoryCount?: number;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<MenuItem> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO menu_items (id, tenant_id, name, description, category, price, food_cost, inventory_count, active, sort_order)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      id,
      tenantId,
      input.name,
      input.description ?? "",
      input.category ?? "general",
      input.price,
      input.foodCost ?? 0,
      input.inventoryCount ?? 0,
      input.active !== false ? 1 : 0,
      input.sortOrder ?? 0,
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM menu_items WHERE id = ?1")
    .bind(id)
    .first<MenuItemRow>();
  return rowToItem(row!);
}

export async function updateMenuItem(
  db: D1Database,
  tenantId: string,
  itemId: string,
  input: {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    foodCost?: number;
    inventoryCount?: number;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<MenuItem | null> {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { fields.push("name = ?" + (params.length + 1)); params.push(input.name); }
  if (input.description !== undefined) { fields.push("description = ?" + (params.length + 1)); params.push(input.description); }
  if (input.category !== undefined) { fields.push("category = ?" + (params.length + 1)); params.push(input.category); }
  if (input.price !== undefined) { fields.push("price = ?" + (params.length + 1)); params.push(input.price); }
  if (input.foodCost !== undefined) { fields.push("food_cost = ?" + (params.length + 1)); params.push(input.foodCost); }
  if (input.inventoryCount !== undefined) { fields.push("inventory_count = ?" + (params.length + 1)); params.push(input.inventoryCount); }
  if (input.active !== undefined) { fields.push("active = ?" + (params.length + 1)); params.push(input.active ? 1 : 0); }
  if (input.sortOrder !== undefined) { fields.push("sort_order = ?" + (params.length + 1)); params.push(input.sortOrder); }

  if (fields.length === 0) return getMenuItem(db, tenantId, itemId);

  fields.push("updated_at = datetime('now')");
  params.push(tenantId, itemId);

  await db
    .prepare(
      `UPDATE menu_items SET ${fields.join(", ")} WHERE tenant_id = ?${params.length - 1} AND id = ?${params.length}`,
    )
    .bind(...params)
    .run();

  return getMenuItem(db, tenantId, itemId);
}

export async function deleteMenuItem(
  db: D1Database,
  tenantId: string,
  itemId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM menu_items WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, itemId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function decrementInventory(
  db: D1Database,
  tenantId: string,
  itemId: string,
  quantity: number,
): Promise<MenuItem | null> {
  await db
    .prepare(
      `UPDATE menu_items
       SET inventory_count = MAX(0, inventory_count - ?1), updated_at = datetime('now')
       WHERE tenant_id = ?2 AND id = ?3`,
    )
    .bind(quantity, tenantId, itemId)
    .run();
  return getMenuItem(db, tenantId, itemId);
}
