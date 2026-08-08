-- Phase 5: Tool audit logging for TallaAgent.

CREATE TABLE IF NOT EXISTS tool_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  tool_name TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  safe_result TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tool_audit_log_tenant ON tool_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tool_audit_log_session ON tool_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_audit_log_tool ON tool_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_audit_log_time ON tool_audit_log(start_time);
