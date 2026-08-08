// Property settings repository — D1 data access layer for property_settings.
// Structured key-value settings per tenant, replacing the monolithic CMS JSON blob.

export interface PropertySettingRow {
  id: string;
  tenant_id: string;
  category: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface PropertySetting {
  id: string;
  tenantId: string;
  category: string;
  key: string;
  value: string;
  updatedAt: string;
}

function rowToSetting(row: PropertySettingRow): PropertySetting {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    category: row.category,
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
  };
}

export async function getSetting(
  db: D1Database,
  tenantId: string,
  key: string,
): Promise<PropertySetting | null> {
  const row = await db
    .prepare("SELECT * FROM property_settings WHERE tenant_id = ?1 AND key = ?2")
    .bind(tenantId, key)
    .first<PropertySettingRow>();
  return row ? rowToSetting(row) : null;
}

export async function getSettingValue(
  db: D1Database,
  tenantId: string,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM property_settings WHERE tenant_id = ?1 AND key = ?2")
    .bind(tenantId, key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getSettingsByCategory(
  db: D1Database,
  tenantId: string,
  category: string,
): Promise<PropertySetting[]> {
  const result = await db
    .prepare("SELECT * FROM property_settings WHERE tenant_id = ?1 AND category = ?2 ORDER BY key")
    .bind(tenantId, category)
    .all<PropertySettingRow>();
  return (result.results ?? []).map(rowToSetting);
}

export async function getAllSettings(
  db: D1Database,
  tenantId: string,
): Promise<PropertySetting[]> {
  const result = await db
    .prepare("SELECT * FROM property_settings WHERE tenant_id = ?1 ORDER BY category, key")
    .bind(tenantId)
    .all<PropertySettingRow>();
  return (result.results ?? []).map(rowToSetting);
}

export async function upsertSetting(
  db: D1Database,
  tenantId: string,
  category: string,
  key: string,
  value: string,
): Promise<PropertySetting> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO property_settings (id, tenant_id, category, key, value, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
       ON CONFLICT(tenant_id, key) DO UPDATE SET
         value = excluded.value,
         category = excluded.category,
         updated_at = datetime('now')`,
    )
    .bind(id, tenantId, category, key, value)
    .run();
  const setting = await getSetting(db, tenantId, key);
  return setting!;
}

export async function upsertSettingsBatch(
  db: D1Database,
  tenantId: string,
  settings: Array<{ category: string; key: string; value: string }>,
): Promise<void> {
  if (settings.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO property_settings (id, tenant_id, category, key, value, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
     ON CONFLICT(tenant_id, key) DO UPDATE SET
       value = excluded.value,
       category = excluded.category,
       updated_at = datetime('now')`,
  );
  const batches = settings.map((s) =>
    stmt.bind(crypto.randomUUID(), tenantId, s.category, s.key, s.value),
  );
  await db.batch(batches);
}

export async function deleteSetting(
  db: D1Database,
  tenantId: string,
  key: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM property_settings WHERE tenant_id = ?1 AND key = ?2")
    .bind(tenantId, key)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
