// Path security — validates and sanitizes workspace paths.
//
// Enforces:
//   - All paths must be under /talla/
//   - Tenant isolation via /talla/<tenantId>/ prefix
//   - No ../ traversal
//   - No absolute path escape
//   - No encoded traversal
//   - No access to system/secret paths

const WORKSPACE_ROOT = "/talla";
const MAX_PATH_LENGTH = 512;

/** Blocked path patterns — never allow access */
const BLOCKED_PATTERNS = [
  /\/etc\//,
  /\/var\//,
  /\/usr\//,
  /\/proc\//,
  /\/sys\//,
  /\/dev\//,
  /\.env/,
  /\.secret/,
  /\.key/,
  /\.pem/,
  /wrangler\.json/,
  /node_modules/,
];

/**
 * Get the workspace root for a tenant.
 * Returns /talla/<tenantId>
 */
export function tenantRoot(tenantId: string): string {
  return `${WORKSPACE_ROOT}/${sanitizeSegment(tenantId)}`;
}

/**
 * Get the absolute workspace path for a tenant and relative path.
 * The relative path is resolved under the tenant's workspace root.
 */
export function resolveWorkspacePath(tenantId: string, relativePath: string): string {
  const root = tenantRoot(tenantId);
  const sanitized = sanitizeRelativePath(relativePath);
  return `${root}/${sanitized}`;
}

/**
 * Validate that a path is safe for the given tenant.
 * Returns the resolved absolute path if valid, null if invalid.
 */
export function validatePath(tenantId: string, path: string): string | null {
  if (!path || path.length > MAX_PATH_LENGTH) return null;

  // Decode URL-encoded characters to catch encoded traversal
  const decoded = decodeURIComponent(path);

  // Block traversal patterns
  if (decoded.includes("..")) return null;
  if (decoded.includes("\\")) return null;

  // Block absolute paths that escape workspace
  if (decoded.startsWith("/") && !decoded.startsWith(WORKSPACE_ROOT)) return null;

  // Block system/secret paths
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(decoded)) return null;
  }

  // Resolve to absolute path
  const absolute = decoded.startsWith(WORKSPACE_ROOT)
    ? decoded
    : resolveWorkspacePath(tenantId, decoded);

  // Verify the resolved path is under the tenant root
  const root = tenantRoot(tenantId);
  if (!absolute.startsWith(root) && absolute !== root) return null;

  return absolute;
}

/**
 * Check if a path belongs to a specific tenant.
 */
export function belongsToTenant(path: string, tenantId: string): boolean {
  const root = tenantRoot(tenantId);
  return path === root || path.startsWith(root + "/");
}

/**
 * Check if a path crosses tenant boundaries.
 */
export function isCrossTenantAccess(path: string, tenantId: string): boolean {
  if (!path.startsWith(WORKSPACE_ROOT + "/")) return false;
  return !belongsToTenant(path, tenantId);
}

/**
 * Sanitize a path segment (tenant ID, filename, etc.).
 * Removes characters that could be used for traversal.
 */
function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Sanitize a relative path, removing dangerous components.
 */
function sanitizeRelativePath(relativePath: string): string {
  // Remove leading slashes (we'll prefix with tenant root)
  let cleaned = relativePath.replace(/^\/+/, "");

  // Remove .. components
  cleaned = cleaned
    .split("/")
    .filter((seg) => seg !== ".." && seg !== "." && seg !== "")
    .join("/");

  return cleaned;
}

/**
 * Get a human-readable description of a path for audit logging.
 * Strips the tenant root prefix to avoid leaking internal structure.
 */
export function describePath(path: string): string {
  // Replace tenant root with placeholder
  const match = path.match(/^\/talla\/[^/]+(\/.*)?$/);
  if (match) return match[1] || "/";
  return path;
}

/** Default workspace directory structure for a new tenant */
export const DEFAULT_WORKSPACE_STRUCTURE = [
  "/knowledge",
  "/operations",
  "/reports/daily",
  "/reports/weekly",
  "/reports/monthly",
  "/working",
  "/documents",
  "/generated",
  "/templates",
  "/marketing",
  "/approvals/pending",
  "/approvals/completed",
  "/logs",
];
