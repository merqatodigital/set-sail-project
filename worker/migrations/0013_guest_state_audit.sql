-- Audit log for TallaAgent guest-state adapters (read/write of guest operational
-- truth via Supabase). Mirrors the existing browser_audit / email_log convention.
-- No secrets, no raw payloads — only safe metadata (tool, role, guest context, result).

CREATE TABLE IF NOT EXISTS guest_state_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '',
  tool TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guest_state_audit_tenant ON guest_state_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_state_audit_tool ON guest_state_audit(tenant_id, tool);
