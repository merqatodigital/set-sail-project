-- Phase 6.3: Event ingestion log for event-driven TALA.
-- Persists webhook events for dedup + operator visibility. TallaAgent remains
-- the execution authority; this table is audit/dedup only.

CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  record_id TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'duplicate', 'error', 'pending_approval')),
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  result TEXT,
  error TEXT,
  payload TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_log_event_id ON event_log(event_id);
CREATE INDEX IF NOT EXISTS idx_event_log_tenant ON event_log(tenant_id, event_type, received_at);
