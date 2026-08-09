// Email audit log (outbound + inbound). Audit-only — the Cloudflare email
// service / workflow remains the execution truth.

import type { D1Database } from "@cloudflare/workers-types";

export interface EmailLogRow {
  id: number;
  tenant_id: string;
  direction: "outbound" | "inbound";
  action: string;
  recipient: string | null;
  sender: string | null;
  subject: string | null;
  status: "pending" | "sent" | "failed" | "received" | "rejected";
  message_id: string | null;
  workflow_id: string | null;
  error: string | null;
  created_at: string;
  metadata: string | null;
}

export async function logEmail(
  db: D1Database,
  row: {
    tenantId: string;
    direction: "outbound" | "inbound";
    action: string;
    recipient?: string | null;
    sender?: string | null;
    subject?: string | null;
    status: EmailLogRow["status"];
    messageId?: string | null;
    workflowId?: string | null;
    error?: string | null;
    metadata?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO email_log
        (tenant_id, direction, action, recipient, sender, subject, status, message_id, workflow_id, error, metadata)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      row.tenantId,
      row.direction,
      row.action,
      row.recipient ?? null,
      row.sender ?? null,
      row.subject ?? null,
      row.status,
      row.messageId ?? null,
      row.workflowId ?? null,
      row.error ?? null,
      row.metadata != null ? JSON.stringify(row.metadata) : null,
    )
    .run();
}

export async function getEmailLog(
  db: D1Database,
  tenantId: string,
  limit = 100,
): Promise<EmailLogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM email_log WHERE tenant_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2`,
    )
    .bind(tenantId, limit)
    .all<EmailLogRow>();
  return results;
}
