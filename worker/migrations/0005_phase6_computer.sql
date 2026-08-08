-- Phase 6: Computer workspace tracking
-- Tracks workspace initialization and last action per tenant.

CREATE TABLE IF NOT EXISTS workspace_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  workspace_root TEXT NOT NULL DEFAULT '/talla',
  initialized_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_action TEXT,
  last_action_at TEXT,
  file_count INTEGER DEFAULT 0,
  total_size_bytes INTEGER DEFAULT 0,
  UNIQUE(tenant_id)
);

-- Index for quick tenant lookups
CREATE INDEX IF NOT EXISTS idx_workspace_metadata_tenant
  ON workspace_metadata(tenant_id);
