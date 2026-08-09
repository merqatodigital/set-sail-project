// Durable approval tracking (owner-facing list + audit).
//
// The native Cloudflare AgentWorkflow (runWorkflow / waitForApproval /
// approveWorkflow / rejectWorkflow) performs the actual durable pause/approve/
// resume of the action. This D1 table is the queryable, cross-tenant-safe
// source of truth for the owner approval list and the audit trail. Each row's
// workflow_id links to the native workflow instance.

import type { D1Database } from "@cloudflare/workers-types";

export interface WorkflowApprovalRow {
  id: number;
  workflow_id: string;
  tenant_id: string;
  requested_by: string | null;
  action_name: string;
  action_args: string; // JSON
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "errored";
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_reason: string | null;
}

export async function insertApproval(
  db: D1Database,
  row: {
    workflowId: string;
    tenantId: string;
    requestedBy: string | null;
    actionName: string;
    actionArgs: unknown;
    reason: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO workflow_approvals
        (workflow_id, tenant_id, requested_by, action_name, action_args, reason, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')`,
    )
    .bind(
      row.workflowId,
      row.tenantId,
      row.requestedBy,
      row.actionName,
      JSON.stringify(row.actionArgs),
      row.reason,
    )
    .run();
}

export async function getApprovals(
  db: D1Database,
  tenantId: string,
  opts: { status?: string; limit?: number } = {},
): Promise<WorkflowApprovalRow[]> {
  const limit = opts.limit ?? 100;
  const clauses = ["tenant_id = ?1"];
  const binds: unknown[] = [tenantId];
  if (opts.status) {
    clauses.push("status = ?2");
    binds.push(opts.status);
  }
  const { results } = await db
    .prepare(
      `SELECT * FROM workflow_approvals WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC, id DESC LIMIT ${limit}`,
    )
    .bind(...(binds as (string | number)[]))
    .all<WorkflowApprovalRow>();
  return results;
}

export async function getApprovalByWorkflowId(
  db: D1Database,
  tenantId: string,
  workflowId: string,
): Promise<WorkflowApprovalRow | null> {
  const { results } = await db
    .prepare(
      `SELECT * FROM workflow_approvals WHERE tenant_id = ?1 AND workflow_id = ?2 LIMIT 1`,
    )
    .bind(tenantId, workflowId)
    .all<WorkflowApprovalRow>();
  return results[0] ?? null;
}

export async function decideApproval(
  db: D1Database,
  tenantId: string,
  workflowId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  decisionReason?: string,
): Promise<boolean> {
  const { success } = await db
    .prepare(
      `UPDATE workflow_approvals
       SET status = ?3, decided_at = datetime('now'), decided_by = ?4, decision_reason = ?5
       WHERE tenant_id = ?1 AND workflow_id = ?2 AND status = 'pending'`,
    )
    .bind(tenantId, workflowId, decision, decidedBy, decisionReason ?? null)
    .run();
  return success;
}
