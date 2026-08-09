-- Phase 6.2: Email audit log for TallaAgent.
-- Records outbound (sendGuestEmail) and inbound (onEmail) email events so the
-- owner-facing audit trail captures success/failure and thread mapping.
-- Tenant-scoped; the Cloudflare workflow/email service remains the execution
-- truth — this table is audit only.

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  action TEXT NOT NULL,
  recipient TEXT,
  sender TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'received', 'rejected')),
  message_id TEXT,
  workflow_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_log_tenant
  ON email_log(tenant_id, direction, created_at);
