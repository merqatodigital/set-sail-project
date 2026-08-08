-- Phase 7: Workflow artifact storage
-- Stores workflow-generated artifacts in D1 for reliable cross-invocation persistence.

CREATE TABLE IF NOT EXISTS workflow_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  content TEXT NOT NULL,
  content_length INTEGER NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, workflow_type, artifact_path)
);

CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_tenant
  ON workflow_artifacts(tenant_id, workflow_type);

CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_path
  ON workflow_artifacts(tenant_id, artifact_path);
