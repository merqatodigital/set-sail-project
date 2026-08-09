-- Phase 6.1: Durable approval tracking for TallaAgent.
--
-- The native Cloudflare AgentWorkflow durable gate (runWorkflow +
-- waitForApproval + step.do + approveWorkflow/rejectWorkflow) performs the
-- actual pause/approve/resume of the action. This D1 table provides the
-- owner-facing, cross-tenant-safe LIST/view of pending approvals and the
-- audit trail, because the SDK's internal workflow tracking table lives in
-- the Agent Durable Object storage and is not queryable from the request
-- path. The workflow_id column links each row to its native workflow
-- instance for approve/reject.

CREATE TABLE IF NOT EXISTS workflow_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  requested_by TEXT,
  action_name TEXT NOT NULL,
  action_args TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'errored')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  decided_by TEXT,
  decision_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_tenant_status
  ON workflow_approvals(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow
  ON workflow_approvals(workflow_id);
