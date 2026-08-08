// ComputerService interface — abstracts workspace operations behind a port.
//
// This interface is the ONLY thing TallaAgent imports from the computer module.
// The Cloudflare-specific implementation is behind this interface.
// This enables:
//   1. Testing without @cloudflare/computer (use mock adapter)
//   2. Future backend swaps (container, local, etc.)
//   3. Lazy initialization (responsiveness guard)
//   4. Clear dependency boundary

/**
 * File entry returned by readdir.
 */
export interface FileEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink?: boolean;
}

/**
 * Grep match returned by search.
 */
export interface GrepMatch {
  path: string;
  line: number;
  text: string;
}

/**
 * File stat result.
 */
export interface FileStat {
  size: number;
  mtime: number;
  type: "file" | "dir" | "symlink";
}

/**
 * ComputerService — the port for workspace operations.
 *
 * All methods are async and throw on unrecoverable errors.
 * Callers should catch and return error results to the LLM.
 */
export interface ComputerService {
  /** Whether this adapter is ready to accept operations */
  readonly ready: boolean;

  /** Initialize the workspace (called once during DO startup) */
  initialize(): Promise<void>;

  /** Shutdown the workspace (cleanup resources) */
  shutdown(): Promise<void>;

  // ---- Filesystem operations ----

  /** Read a file as UTF-8 string */
  readFile(path: string): Promise<string>;

  /** Write a file (creates parent dirs if needed) */
  writeFile(path: string, content: string): Promise<void>;

  /** Get file/directory stats */
  stat(path: string): Promise<FileStat>;

  /** List directory entries */
  readdir(path: string): Promise<FileEntry[]>;

  /** Create a directory (recursive if options.recursive) */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /** Remove a file or directory */
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;

  /** Search for text pattern in files (grep) */
  grep(pattern: string, path: string, options?: { ignoreCase?: boolean }): Promise<GrepMatch[]>;
}

/**
 * Null implementation — used when Computer is disabled.
 * All operations throw descriptive errors.
 */
export class NullComputerService implements ComputerService {
  readonly ready = false;

  async initialize(): Promise<void> {
    // No-op
  }

  async shutdown(): Promise<void> {
    // No-op
  }

  private fail(): never {
    throw new Error("Computer workspace is not enabled");
  }

  async readFile(_path: string): Promise<string> {
    this.fail();
  }

  async writeFile(_path: string, _content: string): Promise<void> {
    this.fail();
  }

  async stat(_path: string): Promise<FileStat> {
    this.fail();
  }

  async readdir(_path: string): Promise<FileEntry[]> {
    this.fail();
  }

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.fail();
  }

  async rm(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.fail();
  }

  async grep(
    _pattern: string,
    _path: string,
    _options?: { ignoreCase?: boolean },
  ): Promise<GrepMatch[]> {
    this.fail();
  }
}
