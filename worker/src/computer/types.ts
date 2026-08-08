// Computer workspace types — shared types for the Computer adapter layer.
//
// Architecture:
//   TallaAgent → ComputerAdapter → Policy Engine → Cloudflare Computer Workspace
//
// The adapter provides a stable interface even though Cloudflare Computer
// is preview software with unstable APIs.

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
  size?: number;
  lastModified?: string;
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
}

export interface WorkspaceSearchResult {
  path: string;
  line: number;
  content: string;
}

export interface WorkspaceExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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
  connected: boolean;
  workspaceReady: boolean;
  tenantId: string;
  lastAction: string | null;
  lastActionAt: string | null;
}

// Adapter interface — swap implementations without changing TallaAgent
export interface ComputerAdapter {
  readonly enabled: boolean;

  /** Initialize workspace directory structure for a tenant */
  initWorkspace(tenantId: string): Promise<void>;

  /** List files in a directory */
  list(tenantId: string, path: string): Promise<WorkspaceFileInfo[]>;

  /** Read a file's contents */
  read(tenantId: string, path: string): Promise<WorkspaceReadResult>;

  /** Write content to a file */
  write(tenantId: string, path: string, content: string): Promise<WorkspaceWriteResult>;

  /** Search files for a pattern */
  search(tenantId: string, pattern: string, root?: string): Promise<WorkspaceSearchResult[]>;

  /** Check if a file exists */
  stat(tenantId: string, path: string): Promise<{ exists: boolean; isDirectory: boolean; size?: number }>;

  /** Get workspace status */
  getStatus(tenantId: string): Promise<ComputerStatus>;
}
