-- Phase 6.5: AI Search audit log for TallaAgent knowledge retrieval.
-- Records that a knowledge search happened and what came back — no full
-- document contents, no chain-of-thought, no secrets.

CREATE TABLE IF NOT EXISTS ai_search_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  requested_by TEXT,
  query TEXT NOT NULL,
  category TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_search_audit_tenant ON ai_search_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_search_audit_created ON ai_search_audit(created_at);
