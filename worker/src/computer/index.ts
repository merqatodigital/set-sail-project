// Computer module — workspace operations for TallaAgent.
//
// Real execution lives in TallaAgent.executeComputerTool() which uses
// workspace.fs from @cloudflare/computer directly.
//
// This module provides:
//   - Path security (paths.ts)
//   - Policy engine (policy.ts)
//   - Tool definitions (tools.ts) — registered alongside D1 tools
//   - Shared types (types.ts)

export type {
  PolicyDecision,
  PolicyContext,
  PolicyResult,
  WorkspaceFileInfo,
  WorkspaceReadResult,
  WorkspaceWriteResult,
  WorkspaceSearchResult,
  WorkspaceArtifact,
  ComputerStatus,
} from "./types.js";

export {
  validatePath,
  tenantRoot,
  resolveWorkspacePath,
  belongsToTenant,
  isCrossTenantAccess,
  describePath,
  DEFAULT_WORKSPACE_STRUCTURE,
} from "./paths.js";

export { evaluatePolicy, isAllowed, isBlocked } from "./policy.js";

export { computerTools } from "./tools.js";
