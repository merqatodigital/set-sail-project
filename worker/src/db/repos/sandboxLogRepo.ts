// Sandbox audit log — records sandbox operations and outcomes. No secrets,
// no full sensitive stdout, no chain-of-thought. TallaAgent remains the
// execution authority; this repo only persists audit metadata.

import type { D1Database } from "@cloudflare/workers-types";

export interface SandboxAuditRow {
  tenantId: string;
  requestedBy: string | null;
  operation: string;
  target: string | null;
  durationMs: number | null;
  success: number;
  error: string | null;
}

export async function logSandbox(db: D1Database, row: SandboxAuditRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sandbox_audit
        (tenant_id, requested_by, operation, target, duration_ms, success, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      row.tenantId,
      row.requestedBy,
      row.operation,
      row.target,
      row.durationMs,
      row.success,
      row.error,
    )
    .run();
}
