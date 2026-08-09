// AI Search audit log — records that a knowledge search happened and what
// came back. No full document contents, no chain-of-thought, no secrets.
// TallaAgent remains the execution authority; this repo only persists audit.

import type { D1Database } from "@cloudflare/workers-types";

export interface AISearchAuditRow {
  tenantId: string;
  requestedBy: string | null;
  query: string;
  category: string | null;
  resultCount: number;
  durationMs: number | null;
  success: number;
  error: string | null;
}

export async function logAISearch(db: D1Database, row: AISearchAuditRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ai_search_audit
        (tenant_id, requested_by, query, category, result_count, duration_ms, success, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      row.tenantId,
      row.requestedBy,
      row.query,
      row.category,
      row.resultCount,
      row.durationMs,
      row.success,
      row.error,
    )
    .run();
}
