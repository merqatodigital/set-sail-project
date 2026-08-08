// Housekeeping tasks repository — D1 data access layer for housekeeping_tasks.

export interface HousekeepingTaskRow {
  id: string;
  tenant_id: string;
  room: string;
  area: string;
  task_type: string;
  status: string;
  priority: string;
  assigned_to: string;
  notes: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface HousekeepingTask {
  id: string;
  tenantId: string;
  room: string;
  area: string;
  taskType: string;
  status: string;
  priority: string;
  assignedTo: string;
  notes: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

function rowToTask(row: HousekeepingTaskRow): HousekeepingTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    room: row.room,
    area: row.area,
    taskType: row.task_type,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    notes: row.notes,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateHousekeepingTaskInput {
  room: string;
  area?: string;
  taskType?: string;
  priority?: string;
  assignedTo?: string;
  notes?: string;
}

export async function createHousekeepingTask(
  db: D1Database,
  tenantId: string,
  input: CreateHousekeepingTaskInput,
): Promise<HousekeepingTask> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO housekeeping_tasks (id, tenant_id, room, area, task_type, status, priority, assigned_to, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7, ?8)`,
    )
    .bind(
      id,
      tenantId,
      input.room,
      input.area ?? "",
      input.taskType ?? "cleaning",
      input.priority ?? "normal",
      input.assignedTo ?? "",
      input.notes ?? "",
    )
    .run();
  const task = await db
    .prepare("SELECT * FROM housekeeping_tasks WHERE id = ?1")
    .bind(id)
    .first<HousekeepingTaskRow>();
  return rowToTask(task!);
}

export async function listHousekeepingTasks(
  db: D1Database,
  tenantId: string,
  filters?: { status?: string; room?: string; limit?: number },
): Promise<HousekeepingTask[]> {
  let query = "SELECT * FROM housekeeping_tasks WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];

  if (filters?.status) {
    query += " AND status = ?2";
    params.push(filters.status);
  }
  if (filters?.room) {
    const idx = params.length + 1;
    query += ` AND room = ?${idx}`;
    params.push(filters.room);
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
    .all<HousekeepingTaskRow>();
  return (result.results ?? []).map(rowToTask);
}

export async function getHousekeepingTask(
  db: D1Database,
  tenantId: string,
  taskId: string,
): Promise<HousekeepingTask | null> {
  const row = await db
    .prepare("SELECT * FROM housekeeping_tasks WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, taskId)
    .first<HousekeepingTaskRow>();
  return row ? rowToTask(row) : null;
}

export async function updateHousekeepingTaskStatus(
  db: D1Database,
  tenantId: string,
  taskId: string,
  status: string,
): Promise<HousekeepingTask | null> {
  const validTransitions: Record<string, string[]> = {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  const current = await db
    .prepare("SELECT status FROM housekeeping_tasks WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, taskId)
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
      `UPDATE housekeeping_tasks
       SET status = ?1, updated_at = datetime('now')${timestampUpdate}
       WHERE tenant_id = ?2 AND id = ?3`,
    )
    .bind(status, tenantId, taskId)
    .run();

  return getHousekeepingTask(db, tenantId, taskId);
}

export async function deleteHousekeepingTask(
  db: D1Database,
  tenantId: string,
  taskId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM housekeeping_tasks WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, taskId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
