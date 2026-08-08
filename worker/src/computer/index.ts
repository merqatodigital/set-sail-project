// Computer module — workspace operations for TallaAgent.
//
// Architecture:
//   TallaAgent → ComputerService interface → CloudflareComputerAdapter → @cloudflare/computer
//
// This module provides:
//   - ComputerService interface (ComputerService.ts) — the port
//   - CloudflareComputerAdapter (CloudflareComputerAdapter.ts) — the implementation
//   - NullComputerService (ComputerService.ts) — null object when disabled
//   - Path security (paths.ts)
//   - Policy engine (policy.ts)
//   - Tool definitions (tools.ts) — registered alongside D1 tools
//   - Shared types (types.ts)

// ---- Service interface and implementations ----
export type { ComputerService, FileEntry, FileStat, GrepMatch } from "./ComputerService.js";
export { NullComputerService } from "./ComputerService.js";
export { CloudflareComputerAdapter } from "./CloudflareComputerAdapter.js";
export { LazyComputerService } from "./LazyComputerService.js";

// ---- Types ----
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

// ---- Path security ----
export {
  validatePath,
  tenantRoot,
  resolveWorkspacePath,
  belongsToTenant,
  isCrossTenantAccess,
  describePath,
  DEFAULT_WORKSPACE_STRUCTURE,
} from "./paths.js";

// ---- Policy engine ----
export { evaluatePolicy, isAllowed, isBlocked } from "./policy.js";

// ---- Tool definitions ----
export { computerTools } from "./tools.js";
