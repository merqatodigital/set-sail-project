// Computer adapter — abstraction layer over Cloudflare Computer.
//
// This is the interface TallaAgent depends on.
// If Cloudflare Computer API changes, replace CloudflareComputerWorkspace
// without touching TallaAgent or the tool definitions.

export type {
  ComputerAdapter,
  WorkspaceFileInfo,
  WorkspaceReadResult,
  WorkspaceWriteResult,
  WorkspaceSearchResult,
  WorkspaceExecResult,
  WorkspaceArtifact,
  ComputerStatus,
  PolicyContext,
  PolicyResult,
  PolicyDecision,
} from "./types.js";

export { CloudflareComputerWorkspace } from "./CloudflareComputerWorkspace.js";
export { validatePath, tenantRoot, resolveWorkspacePath, belongsToTenant, isCrossTenantAccess, describePath, DEFAULT_WORKSPACE_STRUCTURE } from "./paths.js";
export { evaluatePolicy, isAllowed, isBlocked } from "./policy.js";
