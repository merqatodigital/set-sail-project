// Tours repository — D1 data access layer for tours_catalog.
// All queries are parameterized and tenant-scoped.

export interface TourRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  duration: string;
  price: number;
  capacity: number;
  inclusions: string;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: number;
  capacity: number;
  inclusions: string[];
  active: boolean;
  sortOrder: number;
}

function rowToTour(row: TourRow): Tour {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    duration: row.duration,
    price: row.price,
    capacity: row.capacity,
    inclusions: JSON.parse(row.inclusions || "[]"),
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

/**
 * List active tours for a tenant. Public-facing (guest safe).
 */
export async function listActiveTours(
  db: D1Database,
  tenantId: string,
): Promise<Tour[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM tours_catalog
       WHERE tenant_id = ?1 AND active = 1
       ORDER BY sort_order ASC`,
    )
    .bind(tenantId)
    .all<TourRow>();
  return results.map(rowToTour);
}

/**
 * List all tours for a tenant. Admin-only.
 */
export async function listAllTours(
  db: D1Database,
  tenantId: string,
): Promise<Tour[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM tours_catalog
       WHERE tenant_id = ?1
       ORDER BY sort_order ASC`,
    )
    .bind(tenantId)
    .all<TourRow>();
  return results.map(rowToTour);
}

/**
 * Get a single tour by ID, scoped to tenant.
 */
export async function getTour(
  db: D1Database,
  tenantId: string,
  tourId: string,
): Promise<Tour | null> {
  const row = await db
    .prepare(
      `SELECT * FROM tours_catalog
       WHERE tenant_id = ?1 AND id = ?2`,
    )
    .bind(tenantId, tourId)
    .first<TourRow>();
  return row ? rowToTour(row) : null;
}
