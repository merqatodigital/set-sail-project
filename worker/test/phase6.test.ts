// Phase 6 tests — Computer workspace integration, policy engine,
// path security, tenant isolation, feature flag, and fallback behavior.
//
// Tests are organized by category:
//   1. Feature flag
//   2. Path security
//   3. Policy engine
//   4. Tenant isolation
//   5. Tool registration
//   6. System prompt
//   7. Fallback behavior
//   8. Regression (existing D1 tools)

import { describe, it, expect } from "vitest";

// Import the actual modules
import {
  validatePath,
  tenantRoot,
  resolveWorkspacePath,
  belongsToTenant,
  isCrossTenantAccess,
  describePath,
  DEFAULT_WORKSPACE_STRUCTURE,
} from "../src/computer/paths.js";
import { evaluatePolicy, isAllowed, isBlocked } from "../src/computer/policy.js";
import { computerTools } from "../src/computer/tools.js";
import { getTools } from "../src/agents/tools/index.js";
import { buildSystemPrompt } from "../src/agents/systemPrompt.js";

// ============================================================
// 1. FEATURE FLAG
// ============================================================

describe("Phase 6 — Feature Flag", () => {
  it("TALLA_COMPUTER_ENABLED defaults to undefined (disabled)", () => {
    // In test env, the flag is not set
    const enabled = process.env.TALLA_COMPUTER_ENABLED === "true";
    expect(enabled).toBe(false);
  });

  it("Computer tools are NOT included when disabled", () => {
    const tools = getTools("owner", false);
    const computerToolNames = tools.filter((t) =>
      t.name.startsWith("workspace"),
    );
    expect(computerToolNames).toHaveLength(0);
  });

  it("Computer tools ARE included when enabled for owner", () => {
    const tools = getTools("owner", true);
    const computerToolNames = tools.filter((t) =>
      t.name.startsWith("workspace"),
    );
    expect(computerToolNames.length).toBeGreaterThan(0);
  });

  it("Computer tools are NOT included for guest even when enabled", () => {
    const tools = getTools(null, true);
    const computerToolNames = tools.filter((t) =>
      t.name.startsWith("workspace"),
    );
    expect(computerToolNames).toHaveLength(0);
  });

  it("Computer tools are NOT included for non-owner roles when enabled", () => {
    const tools = getTools("staff", true);
    const computerToolNames = tools.filter((t) =>
      t.name.startsWith("workspace"),
    );
    expect(computerToolNames).toHaveLength(0);
  });

  it("existing D1 tools still work when Computer is disabled", () => {
    const tools = getTools("owner", false);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("getPropertyInfo");
    expect(toolNames).toContain("getTours");
    expect(toolNames).toContain("getMenu");
    expect(toolNames).toContain("getInventory");
    expect(toolNames).toContain("createGuestRequest");
    expect(toolNames).toContain("createHousekeepingTask");
    expect(toolNames).toContain("createMaintenanceRequest");
    expect(toolNames).toContain("createFoodOrder");
    expect(toolNames).toContain("getTodayOperations");
  });

  it("existing D1 tools still work when Computer is enabled", () => {
    const tools = getTools("owner", true);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("getPropertyInfo");
    expect(toolNames).toContain("getTours");
    expect(toolNames).toContain("getMenu");
    expect(toolNames).toContain("getInventory");
    expect(toolNames).toContain("createGuestRequest");
    expect(toolNames).toContain("createHousekeepingTask");
    expect(toolNames).toContain("createMaintenanceRequest");
    expect(toolNames).toContain("createFoodOrder");
    expect(toolNames).toContain("getTodayOperations");
  });
});

// ============================================================
// 2. PATH SECURITY
// ============================================================

describe("Phase 6 — Path Security", () => {
  it("tenantRoot returns /talla/<tenantId>", () => {
    expect(tenantRoot("marina_terrace")).toBe("/talla/marina_terrace");
    expect(tenantRoot("test_resort_b")).toBe("/talla/test_resort_b");
  });

  it("resolveWorkspacePath resolves relative path under tenant root", () => {
    const path = resolveWorkspacePath("marina_terrace", "reports/daily");
    expect(path).toBe("/talla/marina_terrace/reports/daily");
  });

  it("resolveWorkspacePath handles leading slash", () => {
    const path = resolveWorkspacePath("marina_terrace", "/reports/daily");
    expect(path).toBe("/talla/marina_terrace/reports/daily");
  });

  it("validatePath accepts valid workspace paths", () => {
    const result = validatePath("marina_terrace", "reports/daily/2026-08-08.md");
    expect(result).toBe("/talla/marina_terrace/reports/daily/2026-08-08.md");
  });

  it("validatePath rejects path traversal with ..", () => {
    expect(validatePath("marina_terrace", "../../etc/passwd")).toBeNull();
    expect(validatePath("marina_terrace", "reports/../../secret")).toBeNull();
  });

  it("validatePath rejects encoded traversal", () => {
    expect(validatePath("marina_terrace", "%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(validatePath("marina_terrace", "reports/%2e%2e/secret")).toBeNull();
  });

  it("validatePath rejects absolute paths outside workspace", () => {
    expect(validatePath("marina_terrace", "/etc/passwd")).toBeNull();
    expect(validatePath("marina_terrace", "/var/log")).toBeNull();
    expect(validatePath("marina_terrace", "/usr/bin")).toBeNull();
  });

  it("validatePath rejects system paths", () => {
    expect(validatePath("marina_terrace", "/talla/marina_terrace/../../../etc/passwd")).toBeNull();
    expect(validatePath("marina_terrace", "wrangler.json")).toBeNull();
    expect(validatePath("marina_terrace", ".env")).toBeNull();
    expect(validatePath("marina_terrace", "node_modules/package")).toBeNull();
  });

  it("validatePath rejects paths that escape tenant root", () => {
    expect(validatePath("marina_terrace", "../test_resort_b/file")).toBeNull();
    expect(validatePath("marina_terrace", "/talla/test_resort_b/file")).toBeNull();
  });

  it("validatePath rejects null/empty paths", () => {
    expect(validatePath("marina_terrace", "")).toBeNull();
    expect(validatePath("marina_terrace", "")).toBeNull();
  });

  it("validatePath rejects very long paths", () => {
    const longPath = "a".repeat(600);
    expect(validatePath("marina_terrace", longPath)).toBeNull();
  });

  it("belongsToTenant identifies tenant-owned paths", () => {
    expect(belongsToTenant("/talla/marina_terrace/reports", "marina_terrace")).toBe(true);
    expect(belongsToTenant("/talla/marina_terrace", "marina_terrace")).toBe(true);
    expect(belongsToTenant("/talla/test_resort_b/reports", "marina_terrace")).toBe(false);
  });

  it("isCrossTenantAccess detects cross-tenant attempts", () => {
    expect(isCrossTenantAccess("/talla/test_resort_b/file", "marina_terrace")).toBe(true);
    expect(isCrossTenantAccess("/talla/marina_terrace/file", "marina_terrace")).toBe(false);
    expect(isCrossTenantAccess("/other/path", "marina_terrace")).toBe(false);
  });

  it("describePath strips tenant root for logging", () => {
    expect(describePath("/talla/marina_terrace/reports/daily")).toBe("/reports/daily");
    expect(describePath("/talla/marina_terrace")).toBe("/");
    expect(describePath("/other/path")).toBe("/other/path");
  });

  it("DEFAULT_WORKSPACE_STRUCTURE contains expected directories", () => {
    expect(DEFAULT_WORKSPACE_STRUCTURE).toContain("/reports/daily");
    expect(DEFAULT_WORKSPACE_STRUCTURE).toContain("/reports/weekly");
    expect(DEFAULT_WORKSPACE_STRUCTURE).toContain("/knowledge");
    expect(DEFAULT_WORKSPACE_STRUCTURE).toContain("/working");
    expect(DEFAULT_WORKSPACE_STRUCTURE).toContain("/generated");
    expect(DEFAULT_WORKSPACE_STRUCTURE).toContain("/logs");
  });
});

// ============================================================
// 3. POLICY ENGINE
// ============================================================

describe("Phase 6 — Policy Engine", () => {
  it("owner can read workspace files", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "read",
      path: "/talla/marina_terrace/reports/daily/2026-08-08.md",
    });
    expect(result.decision).toBe("AUTO_APPROVED");
  });

  it("owner can list workspace directories", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "list",
      path: "/talla/marina_terrace/reports",
    });
    expect(result.decision).toBe("AUTO_APPROVED");
  });

  it("owner can search workspace", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "search",
      path: "/talla/marina_terrace/reports",
    });
    expect(result.decision).toBe("AUTO_APPROVED");
  });

  it("owner can write to reports directory", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "write",
      path: "/talla/marina_terrace/reports/daily/2026-08-08.md",
    });
    expect(result.decision).toBe("AUTO_APPROVED");
  });

  it("owner can write to working directory", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "write",
      path: "/talla/marina_terrace/working/analysis.md",
    });
    expect(result.decision).toBe("AUTO_APPROVED");
  });

  it("owner can write to generated directory", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "write",
      path: "/talla/marina_terrace/generated/campaign.md",
    });
    expect(result.decision).toBe("AUTO_APPROVED");
  });

  it("guest is BLOCKED from all Computer operations", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: null,
      role: null,
      action: "read",
      path: "/talla/marina_terrace/reports",
    });
    expect(result.decision).toBe("BLOCKED");
    expect(result.reason).toContain("owner/admin");
  });

  it("staff is BLOCKED from Computer operations", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u2",
      role: "staff",
      action: "read",
      path: "/talla/marina_terrace/reports",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("secret access is BLOCKED", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "read",
      path: "/talla/marina_terrace/.env",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("cross-tenant access is BLOCKED", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "read",
      path: "/talla/test_resort_b/reports",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("path escape is BLOCKED", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "read",
      path: "/etc/passwd",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("publish action REQUIRES_APPROVAL", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "publish",
      path: "/talla/marina_terrace/reports/daily.md",
    });
    expect(result.decision).toBe("REQUIRES_APPROVAL");
  });

  it("deploy action REQUIRES_APPROVAL", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "deploy",
      path: "/talla/marina_terrace/site",
    });
    expect(result.decision).toBe("REQUIRES_APPROVAL");
  });

  it("delete of reports REQUIRES_APPROVAL", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "delete",
      path: "/talla/marina_terrace/reports/old-report.md",
    });
    expect(result.decision).toBe("REQUIRES_APPROVAL");
  });

  it("isAllowed returns true for auto-approved actions", () => {
    expect(
      isAllowed({
        tenantId: "marina_terrace",
        userId: "u1",
        role: "owner",
        action: "read",
        path: "/talla/marina_terrace/reports/daily.md",
      }),
    ).toBe(true);
  });

  it("isBlocked returns true for blocked actions", () => {
    expect(
      isBlocked({
        tenantId: "marina_terrace",
        userId: "u1",
        role: "owner",
        action: "read",
        path: "/talla/test_resort_b/file",
      }),
    ).toBe(true);
  });
});

// ============================================================
// 4. TENANT ISOLATION
// ============================================================

describe("Phase 6 — Tenant Isolation", () => {
  const tenantA = "marina_terrace";
  const tenantB = "test_resort_b";

  it("tenants have separate workspace roots", () => {
    expect(tenantRoot(tenantA)).not.toBe(tenantRoot(tenantB));
    expect(tenantRoot(tenantA)).toBe("/talla/marina_terrace");
    expect(tenantRoot(tenantB)).toBe("/talla/test_resort_b");
  });

  it("tenant A cannot access tenant B workspace via policy", () => {
    const result = evaluatePolicy({
      tenantId: tenantA,
      userId: "u1",
      role: "owner",
      action: "read",
      path: `/talla/${tenantB}/reports/daily.md`,
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("tenant B cannot access tenant A workspace via policy", () => {
    const result = evaluatePolicy({
      tenantId: tenantB,
      userId: "u1",
      role: "owner",
      action: "read",
      path: `/talla/${tenantA}/reports/daily.md`,
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("tenant A cannot write to tenant B workspace", () => {
    const result = evaluatePolicy({
      tenantId: tenantA,
      userId: "u1",
      role: "owner",
      action: "write",
      path: `/talla/${tenantB}/reports/daily.md`,
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("tenant A cannot list tenant B workspace", () => {
    const result = evaluatePolicy({
      tenantId: tenantA,
      userId: "u1",
      role: "owner",
      action: "list",
      path: `/talla/${tenantB}`,
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("tenant A cannot search tenant B workspace", () => {
    const result = evaluatePolicy({
      tenantId: tenantA,
      userId: "u1",
      role: "owner",
      action: "search",
      path: `/talla/${tenantB}`,
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("path validation rejects cross-tenant paths", () => {
    const result = validatePath(tenantA, `/../${tenantB}/file`);
    expect(result).toBeNull();
  });

  it("isCrossTenantAccess detects all cross-tenant patterns", () => {
    expect(isCrossTenantAccess(`/talla/${tenantB}/file`, tenantA)).toBe(true);
    expect(isCrossTenantAccess(`/talla/${tenantA}/file`, tenantA)).toBe(false);
    expect(isCrossTenantAccess("/talla/other/file", tenantA)).toBe(true);
  });
});

// ============================================================
// 5. TOOL REGISTRATION
// ============================================================

describe("Phase 6 — Computer Tool Registration", () => {
  it("computerTools array has 4 tools", () => {
    expect(computerTools).toHaveLength(4);
  });

  it("workspaceList tool is properly defined", () => {
    const tool = computerTools.find((t) => t.name === "workspaceList");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("workspace");
    expect(tool!.parameters).toBeDefined();
  });

  it("workspaceRead tool is properly defined", () => {
    const tool = computerTools.find((t) => t.name === "workspaceRead");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("read");
    expect(tool!.parameters).toBeDefined();
  });

  it("workspaceWrite tool is properly defined", () => {
    const tool = computerTools.find((t) => t.name === "workspaceWrite");
    expect(tool).toBeDefined();
    expect(tool!.description.toLowerCase()).toContain("write");
    expect(tool!.parameters).toBeDefined();
  });

  it("workspaceSearch tool is properly defined", () => {
    const tool = computerTools.find((t) => t.name === "workspaceSearch");
    expect(tool).toBeDefined();
    expect(tool!.description.toLowerCase()).toContain("search");
    expect(tool!.parameters).toBeDefined();
  });

  it("workspaceWrite enforces max size", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceWrite");
    expect(tool).toBeDefined();

    const largeContent = "x".repeat(600 * 1024); // 600KB > 512KB limit
    const result = await tool!.execute(
      { path: "test.md", content: largeContent },
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("size");
  });

  it("workspaceRead rejects missing path", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceRead");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      {},
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Path");
  });

  it("workspaceSearch rejects missing pattern", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceSearch");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      {},
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("pattern");
  });
});

// ============================================================
// 6. SYSTEM PROMPT
// ============================================================

describe("Phase 6 — System Prompt Computer Context", () => {
  it("system prompt includes Computer workspace section when enabled for owner", () => {
    const prompt = buildSystemPrompt({
      tenantId: "marina_terrace",
      role: "owner",
      guestName: null,
      guestRoom: null,
      propertyInfo: {},
      tours: [],
      menuItems: [],
      computerEnabled: true,
    });
    expect(prompt).toContain("COMPUTER WORKSPACE");
    expect(prompt).toContain("workspaceList");
    expect(prompt).toContain("workspaceRead");
    expect(prompt).toContain("workspaceWrite");
    expect(prompt).toContain("workspaceSearch");
  });

  it("system prompt does NOT include Computer section when disabled", () => {
    const prompt = buildSystemPrompt({
      tenantId: "marina_terrace",
      role: "owner",
      guestName: null,
      guestRoom: null,
      propertyInfo: {},
      tours: [],
      menuItems: [],
      computerEnabled: false,
    });
    expect(prompt).not.toContain("COMPUTER WORKSPACE");
  });

  it("system prompt does NOT include Computer section for guest", () => {
    const prompt = buildSystemPrompt({
      tenantId: "marina_terrace",
      role: null,
      guestName: "John",
      guestRoom: "101",
      propertyInfo: {},
      tours: [],
      menuItems: [],
      computerEnabled: true,
    });
    expect(prompt).not.toContain("COMPUTER WORKSPACE");
  });

  it("system prompt includes D1 authority rule", () => {
    const prompt = buildSystemPrompt({
      tenantId: "marina_terrace",
      role: "owner",
      guestName: null,
      guestRoom: null,
      propertyInfo: {},
      tours: [],
      menuItems: [],
      computerEnabled: true,
    });
    expect(prompt).toContain("D1 is authoritative");
  });

  it("system prompt includes file verification rule", () => {
    const prompt = buildSystemPrompt({
      tenantId: "marina_terrace",
      role: "owner",
      guestName: null,
      guestRoom: null,
      propertyInfo: {},
      tours: [],
      menuItems: [],
      computerEnabled: true,
    });
    expect(prompt).toContain("verify file creation");
  });
});

// ============================================================
// 7. FALLBACK BEHAVIOR
// ============================================================

describe("Phase 6 — Fallback Behavior", () => {
  it("Computer workspace tools return error when policy blocks", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceRead");
    expect(tool).toBeDefined();

    // Guest trying to use Computer tools (blocked by policy)
    const result = await tool!.execute(
      { path: "reports/daily.md" },
      { tenantId: "marina_terrace", userId: null, role: null, db: {} as D1Database },
    );
    // The tool enforces policy — guests are blocked from Computer operations
    expect(result.success).toBe(false);
    expect(result.error).toContain("denied");
  });

  it("D1 tools work independently of Computer", () => {
    const tools = getTools("owner", false);
    expect(tools.length).toBeGreaterThan(0);
    // All D1 tools should be present
    const d1Tools = tools.filter((t) => !t.name.startsWith("workspace"));
    expect(d1Tools.length).toBe(9);
  });

  it("getTools returns consistent count regardless of computer flag", () => {
    const withoutComputer = getTools("owner", false);
    const withComputer = getTools("owner", true);
    expect(withComputer.length).toBe(withoutComputer.length + 4);
  });
});

// ============================================================
// 8. PROMPT INJECTION RESISTANCE
// ============================================================

describe("Phase 6 — Prompt Injection Resistance", () => {
  it("path validation blocks /etc/passwd", () => {
    expect(validatePath("marina_terrace", "/etc/passwd")).toBeNull();
  });

  it("path validation blocks wrangler.json access", () => {
    expect(validatePath("marina_terrace", "wrangler.json")).toBeNull();
    expect(validatePath("marina_terrace", "/talla/marina_terrace/wrangler.json")).toBeNull();
  });

  it("path validation blocks .env access", () => {
    expect(validatePath("marina_terrace", ".env")).toBeNull();
    expect(validatePath("marina_terrace", "/talla/marina_terrace/.env")).toBeNull();
  });

  it("policy blocks secret file access", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "read",
      path: "/talla/marina_terrace/.env",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("policy blocks policy modification attempts", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "exec",
      path: "/talla/marina_terrace/policy.ts",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("policy blocks credential path access", () => {
    const result = evaluatePolicy({
      tenantId: "marina_terrace",
      userId: "u1",
      role: "owner",
      action: "read",
      path: "/talla/marina_terrace/credentials.json",
    });
    expect(result.decision).toBe("BLOCKED");
  });

  it("path traversal with encoded characters is blocked", () => {
    expect(validatePath("marina_terrace", "%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(validatePath("marina_terrace", "%2e%2e%2f%2e%2e%2fetc%2fpasswd")).toBeNull();
  });

  it("backslash traversal is blocked", () => {
    expect(validatePath("marina_terrace", "..\\..\\etc\\passwd")).toBeNull();
  });
});

// ============================================================
// 9. ARTIFACT METADATA
// ============================================================

describe("Phase 6 — Artifact Metadata", () => {
  it("workspaceWrite tool returns structured data", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceWrite");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { path: "reports/daily/2026-08-08.md", content: "# Daily Report" },
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data.operation).toBe("workspaceWrite");
    expect(data.tenantId).toBe("marina_terrace");
    expect(typeof data.contentLength).toBe("number");
  });

  it("workspaceRead tool returns structured data", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceRead");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { path: "reports/daily/2026-08-08.md" },
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data.operation).toBe("workspaceRead");
    expect(data.tenantId).toBe("marina_terrace");
  });

  it("workspaceList tool returns structured data", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceList");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { path: "reports" },
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data.operation).toBe("workspaceList");
    expect(data.tenantId).toBe("marina_terrace");
  });

  it("workspaceSearch tool returns structured data", async () => {
    const tool = computerTools.find((t) => t.name === "workspaceSearch");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { pattern: "TODO", path: "reports" },
      { tenantId: "marina_terrace", userId: "u1", role: "owner", db: {} as D1Database },
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data.operation).toBe("workspaceSearch");
    expect(data.tenantId).toBe("marina_terrace");
    expect(data.pattern).toBe("TODO");
  });
});

// ============================================================
// 10. WORKSPACE STATUS
// ============================================================

describe("Phase 6 — Workspace Status", () => {
  it("CloudflareComputerWorkspace returns status", async () => {
    // Dynamic import to avoid issues in test env
    const { CloudflareComputerWorkspace } = await import("../src/computer/CloudflareComputerWorkspace.js");
    const adapter = new CloudflareComputerWorkspace(true);
    const status = await adapter.getStatus("marina_terrace");

    expect(status.enabled).toBe(true);
    expect(status.connected).toBe(true);
    expect(status.workspaceReady).toBe(true);
    expect(status.tenantId).toBe("marina_terrace");
  });

  it("CloudflareComputerWorkspace reports disabled when not enabled", async () => {
    const { CloudflareComputerWorkspace } = await import("../src/computer/CloudflareComputerWorkspace.js");
    const adapter = new CloudflareComputerWorkspace(false);
    const status = await adapter.getStatus("marina_terrace");

    expect(status.enabled).toBe(false);
    expect(status.connected).toBe(false);
    expect(status.workspaceReady).toBe(false);
  });
});
