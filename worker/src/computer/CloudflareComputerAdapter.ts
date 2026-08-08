// CloudflareComputerAdapter — wraps @cloudflare/computer Workspace behind ComputerService.
//
// This is the ONLY file that imports from @cloudflare/computer.
// The adapter translates between our ComputerService interface and the
// @cloudflare/computer API.
//
// Key design decisions:
//   - Workspace is backed by DO SQLite (durable across DO restarts)
//   - WorkerJavaScriptBackend uses the same DO SQLite (no separate state)
//   - fs.writeFile writes directly to DO SQLite immediately
//   - No push/pull sync needed for filesystem operations

import { Workspace, type DurableObjectStorageLike } from "@cloudflare/computer";
import { WorkerJavaScriptBackend } from "@cloudflare/computer/backends/worker-javascript";
import type { ComputerService, FileEntry, FileStat, GrepMatch } from "./ComputerService.js";

// Re-export DurableObjectStorageLike for consumers
export type { DurableObjectStorageLike } from "@cloudflare/computer";

/**
 * Options for creating a CloudflareComputerAdapter.
 */
export interface CloudflareComputerAdapterOptions {
  /** Durable Object storage (ctx.storage) */
  storage: DurableObjectStorageLike;
  /** Worker Loader binding for the backend */
  loader: {
    load(code: {
      compatibilityDate: string;
      compatibilityFlags?: string[];
      limits?: { cpuMs?: number };
      mainModule: string;
      modules: Record<string, string | { js?: string }>;
      globalOutbound?: unknown;
    }): {
      getEntrypoint(name?: string, options?: { limits?: { cpuMs?: number } }): unknown;
    };
  };
  /** waitUntil binding (ctx.waitUntil.bind(ctx.ctx)) */
  waitUntil: (promise: Promise<unknown>) => void;
  /** Tenant ID for logging */
  tenantId?: string;
}

/**
 * CloudflareComputerAdapter — ComputerService backed by @cloudflare/computer.
 *
 * Usage:
 *   const adapter = new CloudflareComputerAdapter({ storage, loader, waitUntil });
 *   await adapter.initialize();
 *   await adapter.writeFile("/talla/marina_terrace/reports/test.md", "hello");
 *   const content = await adapter.readFile("/talla/marina_terrace/reports/test.md");
 */
export class CloudflareComputerAdapter implements ComputerService {
  #workspace: Workspace | null = null;
  #ready = false;
  #tenantId: string;

  constructor(private readonly options: CloudflareComputerAdapterOptions) {
    this.#tenantId = options.tenantId || "unknown";
  }

  get ready(): boolean {
    return this.#ready;
  }

  async initialize(): Promise<void> {
    if (this.#ready) return;

    try {
      const backend = new WorkerJavaScriptBackend({
        loader: this.options.loader,
      });

      this.#workspace = new Workspace({
        storage: this.options.storage,
        backends: [backend],
        waitUntil: this.options.waitUntil,
      });

      await this.#workspace.ready();
      this.#ready = true;
      console.log(
        `[CloudflareComputerAdapter] Workspace initialized for tenant: ${this.#tenantId}`,
      );
    } catch (err) {
      console.log(`[CloudflareComputerAdapter] Failed to initialize: ${(err as Error).message}`);
      this.#workspace = null;
      this.#ready = false;
      throw err;
    }
  }

  async shutdown(): Promise<void> {
    // Workspace doesn't have an explicit shutdown, but we clear the reference
    this.#workspace = null;
    this.#ready = false;
  }

  // ---- Internal helpers ----

  #getWorkspace(): Workspace {
    if (!this.#workspace) {
      throw new Error("Computer workspace is not initialized");
    }
    return this.#workspace;
  }

  // ---- Filesystem operations ----

  async readFile(path: string): Promise<string> {
    return this.#getWorkspace().fs.readFile(path, "utf8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.#getWorkspace().fs.writeFile(path, content);
  }

  async stat(path: string): Promise<FileStat> {
    const stat = (await this.#getWorkspace().fs.stat(path)) as {
      size: number;
      mtime?: number;
      type?: string;
    };
    return {
      size: stat.size,
      mtime: stat.mtime ?? 0,
      type: (stat.type as FileStat["type"]) ?? "file",
    };
  }

  async readdir(path: string): Promise<FileEntry[]> {
    const entries = await this.#getWorkspace().fs.readdir(path);
    return entries.map((e) => ({
      name: e.name,
      isFile: e.isFile,
      isDirectory: e.isDirectory,
      isSymlink: e.isSymbolicLink,
    }));
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.#getWorkspace().fs.mkdir(path, { recursive: options?.recursive ?? false });
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.#getWorkspace().fs.rm(path, { recursive: options?.recursive ?? false });
  }

  async grep(
    pattern: string,
    path: string,
    options?: { ignoreCase?: boolean },
  ): Promise<GrepMatch[]> {
    const hits = await this.#getWorkspace().fs.grep(pattern, path, {
      ignoreCase: options?.ignoreCase ?? false,
    });
    return hits.map((h) => ({
      path: h.path,
      line: h.line,
      text: h.text,
    }));
  }
}
