-- Phase 6.4: Browser Run audit log for event-driven TALA browser inspections.
-- Read-only observations of public pages. TallaAgent remains the execution
-- authority; this table is audit only (no raw HTML / secrets / cookies).

CREATE TABLE IF NOT EXISTS browser_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  requested_by TEXT,          -- role or event trigger source
  trigger TEXT,               -- "chat" | "event:booking.created" | etc.
  url TEXT NOT NULL,
  domain TEXT,
  action TEXT NOT NULL,       -- "inspect" | "read"
  started_at TEXT NOT NULL,
  completed_at TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER,        -- HTTP status if known
  error TEXT,
  result_meta TEXT,           -- concise JSON: title/link count/truncated note
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_browser_audit_tenant ON browser_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_browser_audit_url ON browser_audit(url);
