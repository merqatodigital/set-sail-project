// Computer tools — Talla's workspace tools for the LLM.
//
// These tools wrap the Computer workspace operations and enforce policy.
// They are registered alongside the existing D1 resort tools.
//
// Tools:
//   workspaceList  — list files in workspace directory
//   workspaceRead  — read a file from workspace
//   workspaceWrite — write a file to workspace
//   workspaceSearch — search files for a pattern

import type { TallaTool, ToolContext, ToolResult } from "../agents/types.js";
import { resolveWorkspacePath, describePath } from "./paths.js";
import { evaluatePolicy } from "./policy.js";

// Maximum file size for writes
const MAX_WRITE_SIZE = 512 * 1024; // 512KB

/**
 * Helper: run a workspace operation through the policy engine.
 * Returns null if allowed, or a ToolResult if blocked/denied.
 */
function enforcePolicy(ctx: ToolContext, action: string, path: string): ToolResult | null {
  const policy = evaluatePolicy({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    role: ctx.role,
    action,
    path,
  });

  if (policy.decision === "BLOCKED") {
    return {
      success: false,
      error: `Access denied: ${policy.reason}`,
    };
  }
  if (policy.decision === "REQUIRES_APPROVAL") {
    return {
      success: false,
      error: `This action requires owner approval: ${policy.reason}`,
    };
  }

  return null; // allowed
}

/**
 * workspaceList — list files in a workspace directory.
 */
export const workspaceListTool: TallaTool = {
  name: "workspaceList",
  description:
    "List files and directories in Talla's workspace. Use this to explore the workspace structure, find reports, or check what files exist.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          'Relative path from workspace root (e.g., "/reports" or "/"). Defaults to "/".',
      },
    },
    required: [],
  },
  execute: async (args, ctx): Promise<ToolResult> => {
    const relativePath = (args.path as string) || "/";
    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    const denied = enforcePolicy(ctx, "list", absolutePath);
    if (denied) return denied;

    // The actual list operation happens in TallaAgent via workspace.fs.readdir
    // This tool returns a marker that TallaAgent intercepts
    return {
      success: true,
      data: {
        operation: "workspaceList",
        path: describePath(absolutePath),
        tenantId: ctx.tenantId,
      },
    };
  },
};

/**
 * workspaceRead — read a file from the workspace.
 */
export const workspaceReadTool: TallaTool = {
  name: "workspaceRead",
  description:
    "Read a file from Talla's workspace. Use this to read reports, documents, notes, or any file Talla has created.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: 'Relative path to the file (e.g., "/reports/daily/2026-08-08.md").',
      },
    },
    required: ["path"],
  },
  execute: async (args, ctx): Promise<ToolResult> => {
    const relativePath = args.path as string;
    if (!relativePath) {
      return { success: false, error: "Path is required" };
    }

    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    const denied = enforcePolicy(ctx, "read", absolutePath);
    if (denied) return denied;

    return {
      success: true,
      data: {
        operation: "workspaceRead",
        path: describePath(absolutePath),
        tenantId: ctx.tenantId,
      },
    };
  },
};

/**
 * workspaceWrite — write a file to the workspace.
 */
export const workspaceWriteTool: TallaTool = {
  name: "workspaceWrite",
  description:
    "Write a file to Talla's workspace. Use this to create reports, save analysis, generate documents, or store working notes.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: 'Relative path for the file (e.g., "/reports/daily/2026-08-08.md").',
      },
      content: {
        type: "string",
        description: "The file content to write.",
      },
    },
    required: ["path", "content"],
  },
  execute: async (args, ctx): Promise<ToolResult> => {
    const relativePath = args.path as string;
    const content = args.content as string;

    if (!relativePath || !content) {
      return { success: false, error: "Path and content are required" };
    }

    if (content.length > MAX_WRITE_SIZE) {
      return {
        success: false,
        error: `Content exceeds maximum size of ${MAX_WRITE_SIZE} bytes`,
      };
    }

    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    const denied = enforcePolicy(ctx, "write", absolutePath);
    if (denied) return denied;

    return {
      success: true,
      data: {
        operation: "workspaceWrite",
        path: describePath(absolutePath),
        contentLength: content.length,
        tenantId: ctx.tenantId,
      },
    };
  },
};

/**
 * workspaceSearch — search files in the workspace.
 */
export const workspaceSearchTool: TallaTool = {
  name: "workspaceSearch",
  description:
    "Search for text across files in Talla's workspace. Use this to find information across reports, notes, and documents.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Text pattern to search for (case-insensitive).",
      },
      path: {
        type: "string",
        description:
          'Relative path to search within (e.g., "/reports"). Defaults to "/" (entire workspace).',
      },
    },
    required: ["pattern"],
  },
  execute: async (args, ctx): Promise<ToolResult> => {
    const pattern = args.pattern as string;
    const relativePath = (args.path as string) || "/";

    if (!pattern) {
      return { success: false, error: "Search pattern is required" };
    }

    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    const denied = enforcePolicy(ctx, "search", absolutePath);
    if (denied) return denied;

    return {
      success: true,
      data: {
        operation: "workspaceSearch",
        pattern,
        path: describePath(absolutePath),
        tenantId: ctx.tenantId,
      },
    };
  },
};

/** All Computer tools */
export const computerTools: TallaTool[] = [
  workspaceListTool,
  workspaceReadTool,
  workspaceWriteTool,
  workspaceSearchTool,
];
