// Maintenance requests repository — D1 data access layer for maintenance_requests.

export interface MaintenanceRequestRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  location: string;
  issue_type: string;
  priority: string;
  status: string;
  assigned_to: string;
  notes: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface MaintenanceRequest {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  location: string;
  issueType: string;
  priority: string;
  status: string;
  assignedTo: string;
  notes: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

function rowToRequest(row: MaintenanceRequestRow): MaintenanceRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    location: row.location,
    issueType: row.issue_type,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    notes: row.notes,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateMaintenanceRequestInput {
  title: string;
  description?: string;
  location?: string;
  issueType?: string;
  priority?: string;
  assignedTo?: string;
  notes?: string;
}

export async function createMaintenanceRequest(
  db: D1Database,
  tenantId: string,
  input: CreateMaintenanceRequestInput,
): Promise<MaintenanceRequest> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO maintenance_requests (id, tenant_id, title, description, location, issue_type, status, priority, assigned_to, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, ?9)`,
    )
    .bind(
      id,
      tenantId,
      input.title,
      input.description ?? "",
      input.location ?? "",
      input.issueType ?? "other",
      input.priority ?? "normal",
      input.assignedTo ?? "",
      input.notes ?? "",
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM maintenance_requests WHERE id = ?1")
    .bind(id)
    .first<MaintenanceRequestRow>();
  return rowToRequest(row!);
}

export async function listMaintenanceRequests(
  db: D1Database,
  tenantId: string,
  filters?: { status?: string; priority?: string; limit?: number },
): Promise<MaintenanceRequest[]> {
  let query = "SELECT * FROM maintenance_requests WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];

  if (filters?.status) {
    query += " AND status = ?2";
    params.push(filters.status);
  }
  if (filters?.priority) {
    const idx = params.length + 1;
    query += ` AND priority = ?${idx}`;
    params.push(filters.priority);
  }

  query += " ORDER BY created_at DESC";

  if (filters?.limit) {
    const idx = params.length + 1;
    query += ` LIMIT ?${idx}`;
    params.push(filters.limit);
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<MaintenanceRequestRow>();
  return (result.results ?? []).map(rowToRequest);
}

export async function getMaintenanceRequest(
  db: D1Database,
  tenantId: string,
  requestId: string,
): Promise<MaintenanceRequest | null> {
  const row = await db
    .prepare("SELECT * FROM maintenance_requests WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, requestId)
    .first<MaintenanceRequestRow>();
  return row ? rowToRequest(row) : null;
}

export async function updateMaintenanceRequestStatus(
  db: D1Database,
  tenantId: string,
  requestId: string,
  status: string,
): Promise<MaintenanceRequest | null> {
  const validTransitions: Record<string, string[]> = {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  const current = await db
    .prepare("SELECT status FROM maintenance_requests WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, requestId)
    .first<{ status: string }>();

  if (!current) return null;

  const allowed = validTransitions[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid status transition: ${current.status} → ${status}`);
  }

  const now = new Date().toISOString();
  let timestampUpdate = "";
  if (status === "in_progress") timestampUpdate = ", started_at = '" + now + "'";
  else if (status === "completed") timestampUpdate = ", completed_at = '" + now + "'";

  await db
    .prepare(
      `UPDATE maintenance_requests
       SET status = ?1, updated_at = datetime('now')${timestampUpdate}
       WHERE tenant_id = ?2 AND id = ?3`,
    )
    .bind(status, tenantId, requestId)
    .run();

  return getMaintenanceRequest(db, tenantId, requestId);
}

export async function deleteMaintenanceRequest(
  db: D1Database,
  tenantId: string,
  requestId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM maintenance_requests WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, requestId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
