// LazyComputerService — defers workspace initialization until first use.
//
// This makes the DO respond faster for chat/health requests.
// The workspace is only initialized when a Computer operation is requested.
//
// Architecture:
//   TallaAgent → LazyComputerService → CloudflareComputerAdapter → @cloudflare/computer
//
// Usage:
//   const service = new LazyComputerService({ storage, loader, waitUntil });
//   // Service is NOT ready yet
//   await service.writeFile("/path", "content"); // initializes first, then writes
//   // Service is now ready

import type { ComputerService, FileEntry, FileStat, GrepMatch } from "./ComputerService.js";
import {
  CloudflareComputerAdapter,
  type CloudflareComputerAdapterOptions,
} from "./CloudflareComputerAdapter.js";

/**
 * LazyComputerService — defers workspace initialization until first use.
 *
 * This is the recommended service to use in TallaAgent because:
 * 1. Chat/health requests don't need Computer workspace
 * 2. Computer operations are rare (owner/admin only)
 * 3. Initialization is expensive (creates backend, waits for ready)
 * 4. Deferring makes the DO respond faster for non-Computer operations
 */
export class LazyComputerService implements ComputerService {
  #adapter: CloudflareComputerAdapter | null = null;
  #initPromise: Promise<void> | null = null;
  #ready = false;
  #options: CloudflareComputerAdapterOptions;

  constructor(options: CloudflareComputerAdapterOptions) {
    this.#options = options;
  }

  get ready(): boolean {
    return this.#ready;
  }

  /**
   * Initialize the workspace (called automatically on first use).
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async initialize(): Promise<void> {
    if (this.#ready) return;
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = this.#doInitialize();
    await this.#initPromise;
  }

  async #doInitialize(): Promise<void> {
    try {
      this.#adapter = new CloudflareComputerAdapter(this.#options);
      await this.#adapter.initialize();
      this.#ready = true;
      console.log(
        `[LazyComputerService] Workspace initialized for tenant: ${this.#options.tenantId || "unknown"}`,
      );
    } catch (err) {
      console.log(`[LazyComputerService] Failed to initialize: ${(err as Error).message}`);
      this.#adapter = null;
      this.#ready = false;
      this.#initPromise = null;
      throw err;
    }
  }

  async shutdown(): Promise<void> {
    if (this.#adapter) {
      await this.#adapter.shutdown();
      this.#adapter = null;
      this.#ready = false;
      this.#initPromise = null;
    }
  }

  #getAdapter(): CloudflareComputerAdapter {
    if (!this.#adapter || !this.#ready) {
      throw new Error("Computer workspace is not initialized. Call initialize() first.");
    }
    return this.#adapter;
  }

  // ---- Filesystem operations (auto-initialize on first use) ----

  async readFile(path: string): Promise<string> {
    await this.initialize();
    return this.#getAdapter().readFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.initialize();
    await this.#getAdapter().writeFile(path, content);
  }

  async stat(path: string): Promise<FileStat> {
    await this.initialize();
    return this.#getAdapter().stat(path);
  }

  async readdir(path: string): Promise<FileEntry[]> {
    await this.initialize();
    return this.#getAdapter().readdir(path);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.initialize();
    await this.#getAdapter().mkdir(path, options);
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.initialize();
    await this.#getAdapter().rm(path, options);
  }

  async grep(
    pattern: string,
    path: string,
    options?: { ignoreCase?: boolean },
  ): Promise<GrepMatch[]> {
    await this.initialize();
    return this.#getAdapter().grep(pattern, path, options);
  }
}
