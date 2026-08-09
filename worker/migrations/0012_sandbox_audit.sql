-- Phase 6.6: Sandbox audit log for TallaAgent secure workbench execution.
-- Records that a sandbox operation happened and what came back — no secrets,
-- no full sensitive stdout, no chain-of-thought.

CREATE TABLE IF NOT EXISTS sandbox_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  requested_by TEXT,
  operation TEXT NOT NULL,         -- writeFile | readFile | listFiles | runAnalysis
  target TEXT,                      -- filename or command category (truncated)
  duration_ms INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sandbox_audit_tenant ON sandbox_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_audit_created ON sandbox_audit(created_at);
