// Talla tasks/leads/goals/briefings/wins repository — D1 data access layer.

// ---- Tasks ----

export interface TalaTaskRow {
  id: string;
  tenant_id: string;
  title: string;
  due: string;
  status: string;
  category: string;
  created_at: string;
}

export interface TalaTask {
  id: string;
  tenantId: string;
  title: string;
  due: string;
  status: string;
  category: string;
  createdAt: string;
}

function rowToTask(row: TalaTaskRow): TalaTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    due: row.due,
    status: row.status,
    category: row.category,
    createdAt: row.created_at,
  };
}

export async function createTask(
  db: D1Database,
  tenantId: string,
  input: { title: string; due?: string; category?: string },
): Promise<TalaTask> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO tala_tasks (id, tenant_id, title, due, status, category)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5)`,
    )
    .bind(id, tenantId, input.title, input.due ?? "", input.category ?? "general")
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_tasks WHERE id = ?1")
    .bind(id)
    .first<TalaTaskRow>();
  return rowToTask(row!);
}

export async function listTasks(
  db: D1Database,
  tenantId: string,
  filters?: { status?: string; category?: string },
): Promise<TalaTask[]> {
  let query = "SELECT * FROM tala_tasks WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];
  if (filters?.status) {
    query += " AND status = ?2";
    params.push(filters.status);
  }
  if (filters?.category) {
    const i = params.length + 1;
    query += ` AND category = ?${i}`;
    params.push(filters.category);
  }
  query += " ORDER BY created_at DESC";
  const result = await db
    .prepare(query)
    .bind(...params)
    .all<TalaTaskRow>();
  return (result.results ?? []).map(rowToTask);
}

export async function updateTaskStatus(
  db: D1Database,
  tenantId: string,
  taskId: string,
  status: string,
): Promise<TalaTask | null> {
  await db
    .prepare("UPDATE tala_tasks SET status = ?1 WHERE tenant_id = ?2 AND id = ?3")
    .bind(status, tenantId, taskId)
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_tasks WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, taskId)
    .first<TalaTaskRow>();
  return row ? rowToTask(row) : null;
}

// ---- Leads ----

export interface TalaLeadRow {
  id: string;
  tenant_id: string;
  name: string;
  contact: string;
  note: string;
  source: string;
  source_url: string;
  created_at: string;
}

export interface TalaLead {
  id: string;
  tenantId: string;
  name: string;
  contact: string;
  note: string;
  source: string;
  sourceUrl: string;
  createdAt: string;
}

function rowToLead(row: TalaLeadRow): TalaLead {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    contact: row.contact,
    note: row.note,
    source: row.source,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}

export async function createLead(
  db: D1Database,
  tenantId: string,
  input: { name: string; contact?: string; note?: string; source?: string; sourceUrl?: string },
): Promise<TalaLead> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO tala_leads (id, tenant_id, name, contact, note, source, source_url)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      id,
      tenantId,
      input.name,
      input.contact ?? "",
      input.note ?? "",
      input.source ?? "talla_chat",
      input.sourceUrl ?? "",
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_leads WHERE id = ?1")
    .bind(id)
    .first<TalaLeadRow>();
  return rowToLead(row!);
}

export async function listLeads(
  db: D1Database,
  tenantId: string,
  filters?: { source?: string; limit?: number },
): Promise<TalaLead[]> {
  let query = "SELECT * FROM tala_leads WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];
  if (filters?.source) {
    query += " AND source = ?2";
    params.push(filters.source);
  }
  query += " ORDER BY created_at DESC";
  if (filters?.limit) {
    const i = params.length + 1;
    query += ` LIMIT ?${i}`;
    params.push(filters.limit);
  }
  const result = await db
    .prepare(query)
    .bind(...params)
    .all<TalaLeadRow>();
  return (result.results ?? []).map(rowToLead);
}

// ---- Goals ----

export interface TalaGoalRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: string;
  target_date: string;
  created_at: string;
}

export interface TalaGoal {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: string;
  targetDate: string;
  createdAt: string;
}

function rowToGoal(row: TalaGoalRow): TalaGoal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    status: row.status,
    targetDate: row.target_date,
    createdAt: row.created_at,
  };
}

export async function createGoal(
  db: D1Database,
  tenantId: string,
  input: { title: string; description?: string; targetDate?: string },
): Promise<TalaGoal> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO tala_goals (id, tenant_id, title, description, status, target_date)
       VALUES (?1, ?2, ?3, ?4, 'active', ?5)`,
    )
    .bind(id, tenantId, input.title, input.description ?? "", input.targetDate ?? "")
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_goals WHERE id = ?1")
    .bind(id)
    .first<TalaGoalRow>();
  return rowToGoal(row!);
}

export async function listGoals(
  db: D1Database,
  tenantId: string,
  filters?: { status?: string },
): Promise<TalaGoal[]> {
  let query = "SELECT * FROM tala_goals WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];
  if (filters?.status) {
    query += " AND status = ?2";
    params.push(filters.status);
  }
  query += " ORDER BY created_at DESC";
  const result = await db
    .prepare(query)
    .bind(...params)
    .all<TalaGoalRow>();
  return (result.results ?? []).map(rowToGoal);
}

export async function updateGoalStatus(
  db: D1Database,
  tenantId: string,
  goalId: string,
  status: string,
): Promise<TalaGoal | null> {
  await db
    .prepare("UPDATE tala_goals SET status = ?1 WHERE tenant_id = ?2 AND id = ?3")
    .bind(status, tenantId, goalId)
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_goals WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, goalId)
    .first<TalaGoalRow>();
  return row ? rowToGoal(row) : null;
}

// ---- Briefings ----

export interface TalaBriefingRow {
  id: string;
  tenant_id: string;
  brief_date: string;
  summary: string;
  highlights: string;
  generated_at: string;
  whatsapp_sent: number;
}

export interface TalaBriefing {
  id: string;
  tenantId: string;
  briefDate: string;
  summary: string;
  highlights: string[];
  generatedAt: string;
  whatsappSent: boolean;
}

function rowToBriefing(row: TalaBriefingRow): TalaBriefing {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    briefDate: row.brief_date,
    summary: row.summary,
    highlights: JSON.parse(row.highlights || "[]"),
    generatedAt: row.generated_at,
    whatsappSent: row.whatsapp_sent === 1,
  };
}

export async function createBriefing(
  db: D1Database,
  tenantId: string,
  input: { briefDate: string; summary: string; highlights?: string[] },
): Promise<TalaBriefing> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO tala_briefings (id, tenant_id, brief_date, summary, highlights)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(id, tenantId, input.briefDate, input.summary, JSON.stringify(input.highlights ?? []))
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_briefings WHERE id = ?1")
    .bind(id)
    .first<TalaBriefingRow>();
  return rowToBriefing(row!);
}

export async function listBriefings(
  db: D1Database,
  tenantId: string,
  filters?: { limit?: number },
): Promise<TalaBriefing[]> {
  let query = "SELECT * FROM tala_briefings WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];
  query += " ORDER BY generated_at DESC";
  if (filters?.limit) {
    const i = params.length + 1;
    query += ` LIMIT ?${i}`;
    params.push(filters.limit);
  }
  const result = await db
    .prepare(query)
    .bind(...params)
    .all<TalaBriefingRow>();
  return (result.results ?? []).map(rowToBriefing);
}

export async function markBriefingWhatsappSent(
  db: D1Database,
  tenantId: string,
  briefingId: string,
): Promise<TalaBriefing | null> {
  await db
    .prepare("UPDATE tala_briefings SET whatsapp_sent = 1 WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, briefingId)
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_briefings WHERE tenant_id = ?1 AND id = ?2")
    .bind(tenantId, briefingId)
    .first<TalaBriefingRow>();
  return row ? rowToBriefing(row) : null;
}

// ---- Wins ----

export interface TalaWinRow {
  id: string;
  tenant_id: string;
  brief_date: string;
  text: string;
  created_at: string;
}

export interface TalaWin {
  id: string;
  tenantId: string;
  briefDate: string;
  text: string;
  createdAt: string;
}

function rowToWin(row: TalaWinRow): TalaWin {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    briefDate: row.brief_date,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function createWin(
  db: D1Database,
  tenantId: string,
  input: { briefDate: string; text: string },
): Promise<TalaWin> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO tala_wins (id, tenant_id, brief_date, text)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(id, tenantId, input.briefDate, input.text)
    .run();
  const row = await db
    .prepare("SELECT * FROM tala_wins WHERE id = ?1")
    .bind(id)
    .first<TalaWinRow>();
  return rowToWin(row!);
}

export async function listWins(
  db: D1Database,
  tenantId: string,
  filters?: { limit?: number },
): Promise<TalaWin[]> {
  let query = "SELECT * FROM tala_wins WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];
  query += " ORDER BY created_at DESC";
  if (filters?.limit) {
    const i = params.length + 1;
    query += ` LIMIT ?${i}`;
    params.push(filters.limit);
  }
  const result = await db
    .prepare(query)
    .bind(...params)
    .all<TalaWinRow>();
  return (result.results ?? []).map(rowToWin);
}
