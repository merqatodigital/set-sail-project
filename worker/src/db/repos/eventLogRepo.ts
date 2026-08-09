// Event ingestion log — dedup + audit for event-driven TALA.
// TallaAgent remains the execution authority; this repo only persists
// received events and tracks dedup/processing state.

import type { D1Database } from "@cloudflare/workers-types";

export type EventStatus =
  | "received"
  | "processed"
  | "duplicate"
  | "error"
  | "pending_approval";

export interface EventLogRow {
  id: number;
  event_id: string;
  event_type: string;
  tenant_id: string;
  record_id: string | null;
  status: EventStatus;
  is_duplicate: number;
  received_at: string;
  processed_at: string | null;
  result: string | null;
  error: string | null;
  payload: string | null;
  metadata: string | null;
}

/**
 * Record a received event. Returns { row, duplicate }.
 * If an event with the same event_id already exists, marks this as a
 * duplicate (is_duplicate=1) and returns the existing row — callers must
 * NOT trigger downstream actions for duplicates.
 */
export async function recordEvent(
  db: D1Database,
  ev: {
    eventId: string;
    eventType: string;
    tenantId: string;
    recordId?: string | null;
    payload: unknown;
  },
): Promise<{ row: EventLogRow; duplicate: boolean }> {
  // Dedup check (idempotency — same event id delivered twice = no double action)
  const existing = await db
    .prepare("SELECT * FROM event_log WHERE event_id = ?1")
    .bind(ev.eventId)
    .first<EventLogRow>();
  if (existing) {
    // Record the duplicate attempt separately (audit), but flag it. If the
    // original was already processed, the caller takes no action.
    await db
      .prepare(
        `INSERT INTO event_log
          (event_id, event_type, tenant_id, record_id, status, is_duplicate, payload)
         VALUES (?1, ?2, ?3, ?4, 'duplicate', 1, ?5)`,
      )
      .bind(
        `${ev.eventId}__dup_${Date.now()}`,
        ev.eventType,
        ev.tenantId,
        ev.recordId ?? null,
        JSON.stringify(ev.payload),
      )
      .run();
    return { row: existing, duplicate: true };
  }

  await db
    .prepare(
      `INSERT INTO event_log
        (event_id, event_type, tenant_id, record_id, status, payload)
       VALUES (?1, ?2, ?3, ?4, 'received', ?5)`,
    )
    .bind(
      ev.eventId,
      ev.eventType,
      ev.tenantId,
      ev.recordId ?? null,
      JSON.stringify(ev.payload),
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM event_log WHERE event_id = ?1")
    .bind(ev.eventId)
    .first<EventLogRow>();
  if (!row) throw new Error("Failed to persist event");
  return { row, duplicate: false };
}

export async function markEventProcessed(
  db: D1Database,
  eventId: string,
  status: EventStatus,
  result?: string,
  error?: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE event_log
       SET status = ?1, processed_at = datetime('now'), result = ?2, error = ?3
       WHERE event_id = ?4`,
    )
    .bind(status, result ?? null, error ?? null, eventId)
    .run();
}

export async function getEventLog(
  db: D1Database,
  tenantId: string,
  limit = 100,
): Promise<EventLogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM event_log WHERE tenant_id = ?1 ORDER BY received_at DESC, id DESC LIMIT ?2`,
    )
    .bind(tenantId, limit)
    .all<EventLogRow>();
  return results;
}
