// Cloudflare Sandbox capability for the existing TallaAgent.
//
// Sandbox = real Linux/code/data execution (Python/Node/file analysis).
// It is SEPARATE from Browser Run (web inspection) and from the existing
// Computer preview workspace. This module is the secure workbench:
//   - owner/admin only (guests blocked)
//   - tenant-scoped sandbox id (tenant A never shares with tenant B)
//   - narrow command policy (Python/Node/safe file ops; destructive blocked)
//   - no Worker secrets, no host filesystem, no env dumping
//   - results audited (no secrets/stdout-in-secrets logged)
//
// Source-of-truth financial/operational data always comes from D1/Supabase
// live tools; Sandbox only computes/analyzes/renders it.

import type { TallaTool } from "../types.js";
import type { Sandbox, ExecResult } from "@cloudflare/sandbox";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { logSandbox } from "../../db/repos/sandboxLogRepo.js";

export interface SandboxEnv {
  Sandbox?: DurableObjectNamespace<Sandbox>;
}

/** Per-tenant sandbox id — isolates tenants; caller never supplies this. */
export function sandboxIdForTenant(tenantId: string): string {
  return `sb-${tenantId}`;
}

/** Narrow command policy: block obviously destructive/unsafe patterns. */
const DENY_PATTERNS: RegExp[] = [
  /\brm\s+-rf?\s+\//i, // rm -rf /
  /\bsudo\b/i,
  /\bchmod\s+-R\s+0/i,
  /:\s*\(\)\s*\{.*\}\s*;/, // fork bombs
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bshutdown\b|\bhalt\b|\breboot\b/i,
  /\bcurl\b.*\|\s*(sh|bash)/i, // pipe to shell
  /\bwget\b.*\|\s*(sh|bash)/i,
  />\s*\/etc\//i, // writing system files
  /\bpasswd\b/i,
  /\bexport\b\s+\w*(TOKEN|SECRET|KEY|PASSWORD)\b/i,
];

export function isCommandAllowed(cmd: string): boolean {
  // Only allowlisted interpreters / safe file utilities at the start.
  const allowedStart = /^\s*(python3?|node|cat|head|tail|wc|sort|uniq|grep|sed|awk|cut|jq|csvkit|ls|echo|printf|python3?\s+-c|node\s+-e)\b/;
  if (!allowedStart.test(cmd)) return false;
  return !DENY_PATTERNS.some((re) => re.test(cmd));
}

async function withSandbox<T>(
  env: SandboxEnv,
  tenantId: string,
  fn: (sb: Sandbox) => Promise<T>,
): Promise<{ ok: boolean; result?: T; error?: string }> {
  const ns = env.Sandbox as unknown as DurableObjectNamespace<Sandbox>;
  if (!ns) {
    return { ok: false, error: "Sandbox binding is not configured." };
  }
  try {
    // Dynamic import keeps the SDK (which uses cloudflare:-scheme internals)
    // out of the unit-test graph and isolates load failures.
    const { getSandbox } = await import("@cloudflare/sandbox");
    const sb = getSandbox(ns as never, sandboxIdForTenant(tenantId));
    const result = await fn(sb);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: `Sandbox error: ${(e as Error).message}` };
  }
}

// ---------- Tools ----------

export const sandboxWriteFileTool: TallaTool = {
  name: "sandboxWriteFile",
  description:
    "Write a file into THIS tenant's isolated Sandbox workspace (e.g. a CSV/JSON of live resort data, or a report draft). Owner/admin only. Used as a scratch workbench for analysis — not for storing operational records.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Workspace-relative path, e.g. '/workspace/arrivals.csv'." },
      content: { type: "string", description: "File contents (text)." },
    },
    required: ["path", "content"],
  },
  execute: async (args, ctx) => {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return { success: false, error: "Sandbox is restricted to owner/admin roles." };
    }
    const env = ctx.env as unknown as SandboxEnv;
    const path = String(args.path || "");
    const content = String(args.content ?? "");
    if (!path.startsWith("/workspace/")) {
      return { success: false, error: "Path must be under /workspace/." };
    }
    const started = Date.now();
    const r = await withSandbox(env, ctx.tenantId, async (sb) => {
      await sb.writeFile(path, content);
      return true;
    });
    await logSandbox(ctx.db, {
      tenantId: ctx.tenantId,
      requestedBy: ctx.role ?? "unknown",
      operation: "writeFile",
      target: path,
      durationMs: Date.now() - started,
      success: r.ok ? 1 : 0,
      error: r.error ?? null,
    });
    return r.ok
      ? { success: true, data: { path, bytes: content.length } }
      : { success: false, error: r.error };
  },
};

export const sandboxReadFileTool: TallaTool = {
  name: "sandboxReadFile",
  description: "Read a file from THIS tenant's isolated Sandbox workspace. Owner/admin only.",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "Workspace path, e.g. '/workspace/report.md'." } },
    required: ["path"],
  },
  execute: async (args, ctx) => {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return { success: false, error: "Sandbox is restricted to owner/admin roles." };
    }
    const env = ctx.env as unknown as SandboxEnv;
    const path = String(args.path || "");
    const started = Date.now();
    const r = await withSandbox(env, ctx.tenantId, async (sb) => {
      const f = await sb.readFile(path);
      return typeof f.content === "string" ? f.content : "";
    });
    await logSandbox(ctx.db, {
      tenantId: ctx.tenantId,
      requestedBy: ctx.role ?? "unknown",
      operation: "readFile",
      target: path,
      durationMs: Date.now() - started,
      success: r.ok ? 1 : 0,
      error: r.error ?? null,
    });
    return r.ok
      ? { success: true, data: { path, content: r.result } }
      : { success: false, error: r.error };
  },
};

export const sandboxListFilesTool: TallaTool = {
  name: "sandboxListFiles",
  description: "List files in THIS tenant's isolated Sandbox workspace. Owner/admin only.",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "Workspace path (default /workspace)." } },
    required: [],
  },
  execute: async (args, ctx) => {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return { success: false, error: "Sandbox is restricted to owner/admin roles." };
    }
    const env = ctx.env as unknown as SandboxEnv;
    const path = String(args.path || "/workspace");
    const started = Date.now();
    const r = await withSandbox(env, ctx.tenantId, async (sb) => {
      const list = await sb.listFiles(path);
      return (list.files || []).map((f) => ({ name: f.name, size: f.size, isDir: f.type === "directory" }));
    });
    await logSandbox(ctx.db, {
      tenantId: ctx.tenantId,
      requestedBy: ctx.role ?? "unknown",
      operation: "listFiles",
      target: path,
      durationMs: Date.now() - started,
      success: r.ok ? 1 : 0,
      error: r.error ?? null,
    });
    return r.ok
      ? { success: true, data: { path, files: r.result } }
      : { success: false, error: r.error };
  },
};

export const sandboxRunAnalysisTool: TallaTool = {
  name: "sandboxRunAnalysis",
  description:
    "Run a SAFE analysis command in THIS tenant's isolated Sandbox (Python/Node for data analysis over files previously written there). Owner/admin only. Use for computing summaries, generating CSV/Markdown artifacts from live resort data already obtained via the live operational tools. Commands are restricted to safe interpreters/file utilities; destructive commands are blocked.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "Allowed: python3/script, node, cat/head/tail/wc/sort/uniq/grep/sed/awk/cut/jq over /workspace files. Destructive commands are rejected.",
      },
    },
    required: ["command"],
  },
  execute: async (args, ctx) => {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return { success: false, error: "Sandbox is restricted to owner/admin roles." };
    }
    const env = ctx.env as unknown as SandboxEnv;
    const command = String(args.command || "");
    if (!isCommandAllowed(command)) {
      return {
        success: false,
        error: "Command not allowed by sandbox policy (use python3/node over /workspace; destructive commands blocked).",
      };
    }
    const started = Date.now();
    const r = await withSandbox(env, ctx.tenantId, async (sb) => {
      const res: ExecResult = await sb.exec(command);
      return {
        stdout: typeof res.stdout === "string" ? res.stdout.slice(0, 4000) : "",
        stderr: typeof res.stderr === "string" ? res.stderr.slice(0, 1000) : "",
        exitCode: res.exitCode,
        success: res.success,
      };
    });
    await logSandbox(ctx.db, {
      tenantId: ctx.tenantId,
      requestedBy: ctx.role ?? "unknown",
      operation: "runAnalysis",
      target: command.length > 120 ? command.slice(0, 120) + "…" : command,
      durationMs: Date.now() - started,
      success: r.ok && r.result?.success ? 1 : 0,
      error: r.error ?? (r.result && !r.result.success ? `exit ${r.result.exitCode}: ${r.result.stderr?.slice(0, 200)}` : null),
    });
    if (!r.ok) return { success: false, error: r.error };
    if (!r.result!.success) {
      return { success: false, error: `Command failed (exit ${r.result!.exitCode}): ${r.result!.stderr}` };
    }
    return {
      success: true,
      data: { stdout: r.result!.stdout, exitCode: r.result!.exitCode },
    };
  },
};
