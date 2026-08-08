// Computer workspace types — shared types for the Computer layer.
//
// Architecture:
//   TallaAgent → workspace.fs (real @cloudflare/computer) → D1 SQLite
//
// The real execution lives in TallaAgent.executeComputerTool().
// This file defines shared types used across the computer module.

export type PolicyDecision = "AUTO_APPROVED" | "REQUIRES_APPROVAL" | "BLOCKED";

export interface PolicyContext {
  tenantId: string;
  userId: string | null;
  role: string | null;
  action: string;
  path: string;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

export interface WorkspaceFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface WorkspaceReadResult {
  content: string;
  path: string;
  size: number;
}

export interface WorkspaceWriteResult {
  success: boolean;
  path: string;
  bytesWritten: number;
  verified: boolean;
}

export interface WorkspaceSearchResult {
  path: string;
  line: number;
  text: string;
}

export interface WorkspaceArtifact {
  success: boolean;
  type: string;
  path: string;
  createdAt: string;
  tenantId: string;
}

export interface ComputerStatus {
  enabled: boolean;
  workspaceInitialized: boolean;
  backend: string;
  tenantId: string;
  lastSuccessfulOperation: string | null;
  lastError: string | null;
  lastOperationAt: string | null;
}
