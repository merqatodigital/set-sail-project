// Browser Run audit log — read-only observations of public pages.
// TallaAgent remains the execution authority; this repo only persists audit
// metadata (no raw HTML, secrets, or cookies).

import type { D1Database } from "@cloudflare/workers-types";

export interface BrowserAuditRow {
  id?: number;
  tenantId: string;
  requestedBy: string | null;
  trigger: string;
  url: string;
  domain: string | null;
  action: "inspect" | "read";
  startedAt: string;
  completedAt: string | null;
  success: number;
  statusCode: number | null;
  error: string | null;
  resultMeta: string | null;
}

export async function logBrowser(
  db: D1Database,
  row: BrowserAuditRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO browser_audit
        (tenant_id, requested_by, trigger, url, domain, action, started_at, completed_at, success, status_code, error, result_meta)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      row.tenantId,
      row.requestedBy,
      row.trigger,
      row.url,
      row.domain,
      row.action,
      row.startedAt,
      row.completedAt,
      row.success,
      row.statusCode,
      row.error,
      row.resultMeta,
    )
    .run();
}
