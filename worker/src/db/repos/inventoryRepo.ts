// Inventory repository — D1 data access layer for inventory_items.

export interface InventoryItemRow {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorder_threshold: number;
  unit_cost: number;
  notes: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  unitCost: number;
  notes: string;
  updatedAt: string;
}

function rowToItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    quantity: row.quantity,
    reorderThreshold: row.reorder_threshold,
    unitCost: row.unit_cost,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export async function listInventory(
  db: D1Database,
  tenantId: string,
  options?: { category?: string; lowStock?: boolean },
): Promise<InventoryItem[]> {
  let query = "SELECT * FROM inventory_items WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];

  if (options?.category) {
    query += " AND category = ?2";
    params.push(options.category);
  }

  if (options?.lowStock) {
    query += " AND reorder_threshold > 0 AND quantity <= reorder_threshold";
  }

  query += " ORDER BY category, name";

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<InventoryItemRow>();
  return (result.results ?? []).map(rowToItem);
}

export async function getInventoryItem(
  db: D1Database,
  tenantId: string,
  itemId: string,
): Promise<InventoryItem | null> {
  const row = await db
    .prepare("SELECT * FROM inventory_items WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, itemId)
    .first<InventoryItemRow>();
  return row ? rowToItem(row) : null;
}

export async function upsertInventoryItem(
  db: D1Database,
  tenantId: string,
  input: {
    id?: string;
    name: string;
    category?: string;
    unit?: string;
    quantity: number;
    reorderThreshold?: number;
    unitCost?: number;
    notes?: string;
  },
): Promise<InventoryItem> {
  const itemId = input.id ?? crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO inventory_items (id, tenant_id, name, category, unit, quantity, reorder_threshold, unit_cost, notes, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         category = excluded.category,
         unit = excluded.unit,
         quantity = excluded.quantity,
         reorder_threshold = excluded.reorder_threshold,
         unit_cost = excluded.unit_cost,
         notes = excluded.notes,
         updated_at = datetime('now')`,
    )
    .bind(
      itemId,
      tenantId,
      input.name,
      input.category ?? "other",
      input.unit ?? "pcs",
      input.quantity,
      input.reorderThreshold ?? 0,
      input.unitCost ?? 0,
      input.notes ?? "",
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM inventory_items WHERE id = ?1")
    .bind(itemId)
    .first<InventoryItemRow>();
  return rowToItem(row!);
}

export async function bulkUpsertInventory(
  db: D1Database,
  tenantId: string,
  items: Array<{
    id?: string;
    name: string;
    category?: string;
    unit?: string;
    quantity: number;
    reorderThreshold?: number;
    unitCost?: number;
    notes?: string;
  }>,
): Promise<void> {
  if (items.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO inventory_items (id, tenant_id, name, category, unit, quantity, reorder_threshold, unit_cost, notes, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       unit = excluded.unit,
       quantity = excluded.quantity,
       reorder_threshold = excluded.reorder_threshold,
       unit_cost = excluded.unit_cost,
       notes = excluded.notes,
       updated_at = datetime('now')`,
  );
  const batches = items.map((item) =>
    stmt.bind(
      item.id ?? crypto.randomUUID(),
      tenantId,
      item.name,
      item.category ?? "other",
      item.unit ?? "pcs",
      item.quantity,
      item.reorderThreshold ?? 0,
      item.unitCost ?? 0,
      item.notes ?? "",
    ),
  );
  await db.batch(batches);
}

export async function deleteInventoryItem(
  db: D1Database,
  tenantId: string,
  itemId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM inventory_items WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, itemId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function adjustInventoryQuantity(
  db: D1Database,
  tenantId: string,
  itemId: string,
  adjustment: number,
): Promise<InventoryItem | null> {
  await db
    .prepare(
      `UPDATE inventory_items
       SET quantity = MAX(0, quantity + ?1), updated_at = datetime('now')
       WHERE tenant_id = ?2 AND id = ?3`,
    )
    .bind(adjustment, tenantId, itemId)
    .run();
  return getInventoryItem(db, tenantId, itemId);
}
