// Browser Run capability for the existing TallaAgent.
//
// Uses Cloudflare Browser Run Quick Actions (stateless, read-only):
//   - browserInspectPage: rendered markdown + links + metadata
//   - browserReadPage: rendered markdown content of a page
//
// Both are READ/OBSERVE only. No navigation-side-effects, no auth, no posting.
// Unsafe targets (localhost, private IPs, file://, credential-bearing URLs,
// non-http(s) protocols) are blocked before any navigation.

import type { TallaTool } from "../types.js";
import { logBrowser } from "../../db/repos/browserLogRepo.js";

// Structural shape of the Browser Run binding (matches `QuickActionBinding`).
export interface BrowserRunBinding {
  quickAction(action: string, options: unknown): Promise<Response>;
}

/** Block navigation to unsafe / internal / secret-bearing targets. */
export function validateBrowserUrl(url: string): { ok: true; url: string } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "Malformed URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Blocked protocol: ${parsed.protocol}` };
  }
  const host = parsed.hostname.toLowerCase();
  // Credential-bearing URLs (user:pass@host) are rejected.
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Credential-bearing URL blocked" };
  }
  // localhost / loopback
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return { ok: false, reason: "Localhost target blocked" };
  }
  // Private / reserved IP ranges
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // link-local
      a === 127 ||
      a === 0
    ) {
      return { ok: false, reason: "Private IP target blocked" };
    }
  }
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".svc") || host.endsWith(".corp")) {
    return { ok: false, reason: "Internal-domain target blocked" };
  }
  return { ok: true, url };
}

export interface InspectResult {
  ok: boolean;
  url: string;
  statusCode?: number;
  title?: string;
  markdown?: string;
  links?: string[];
  error?: string;
}

/** Extract hostname for audit logging; returns null on malformed input. */
function safeDomainLog(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Inspect a public page via Browser Run Quick Actions (markdown + links).
 * Returns a structured result; on failure reports the real error (no hallucination).
 */
export async function inspectPage(
  browser: BrowserRunBinding,
  url: string,
  opts: { includeLinks?: boolean; timeoutMs?: number; maxMarkdownChars?: number } = {},
): Promise<InspectResult> {
  const check = validateBrowserUrl(url);
  if (!check.ok) {
    return { ok: false, url, error: check.reason };
  }

  const timeoutMs = opts.timeoutMs ?? 20000;
  const maxMd = opts.maxMarkdownChars ?? 4000;

  // Render to markdown.
  let markdownRes: Response;
  try {
    markdownRes = await browser.quickAction("markdown", {
      url,
      gotoOptions: { waitUntil: "load", timeout: timeoutMs },
    });
  } catch (e) {
    return { ok: false, url, error: `Browser run failed: ${(e as Error).message}` };
  }

  if (!markdownRes.ok) {
    const body = await markdownRes.text().catch(() => "");
    return {
      ok: false,
      url,
      statusCode: markdownRes.status,
      error: `Page returned HTTP ${markdownRes.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    };
  }

  let markdown = "";
  try {
    markdown = await markdownRes.text();
  } catch (e) {
    return { ok: false, url, statusCode: markdownRes.status, error: `Failed to read page body: ${(e as Error).message}` };
  }

  const result: InspectResult = {
    ok: true,
    url,
    statusCode: markdownRes.status,
    markdown: markdown.length > maxMd ? `${markdown.slice(0, maxMd)}…[truncated]` : markdown,
  };

  // Extract a crude title from the markdown (# Heading or <title>).
  const titleMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  if (opts.includeLinks) {
    try {
      const linksRes = await browser.quickAction("links", { url });
      if (linksRes.ok) {
        const links = (await linksRes.json().catch(() => [])) as string[];
        result.links = links.slice(0, 25);
      }
    } catch {
      // Links are best-effort; do not fail the whole inspection.
    }
  }

  return result;
}

/** Read-only rendered markdown of a page (no links). */
export async function readPage(
  browser: BrowserRunBinding,
  url: string,
  opts: { timeoutMs?: number; maxMarkdownChars?: number } = {},
): Promise<InspectResult> {
  return inspectPage(browser, url, { includeLinks: false, ...opts });
}

const roleGate = (ctx: { role?: string | null }): boolean =>
  ctx.role === "owner" || ctx.role === "admin" || ctx.role === "system";

export const browserInspectPageTool: TallaTool = {
  name: "browserInspectPage",
  description:
    "Inspect a PUBLIC web page with a real headless browser (Cloudflare Browser Run). Returns the rendered page as markdown, key visible sections, and important links. Use for website self-checks, verifying a public booking/listing page is reachable, or retrieving rendered info from a public travel/resort page. READ-ONLY — never submits forms, logs in, or changes anything. Blocked for internal/private/credential URLs.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Fully-qualified public http(s) URL to inspect." },
      includeLinks: { type: "boolean", description: "Also return the page's important links (default true)." },
    },
    required: ["url"],
  },
  execute: async (args, ctx) => {
    if (!roleGate(ctx as { role?: string | null })) {
      return { success: false, error: "Browser inspection is restricted to owner/admin roles." };
    }
    const browser = (ctx as unknown as { env: { BROWSER?: BrowserRunBinding } }).env?.BROWSER;
    if (!browser) {
      return { success: false, error: "Browser Run binding is not configured." };
    }
    const url = (args.url as string) || "";
    const startedAt = new Date().toISOString();
    const res = await inspectPage(browser, url, {
      includeLinks: args.includeLinks !== false,
    });
    await logBrowser(ctx.db, {
      tenantId: ctx.tenantId,
      requestedBy: ctx.role ?? "unknown",
      trigger: "chat",
      url,
      domain: safeDomainLog(url),
      action: "inspect",
      startedAt,
      completedAt: new Date().toISOString(),
      success: res.ok ? 1 : 0,
      statusCode: res.statusCode ?? null,
      error: res.error ?? null,
      resultMeta: JSON.stringify({ title: res.title ?? null, linkCount: res.links?.length ?? 0 }),
    });
    if (!res.ok) {
      return { success: false, error: res.error || "Browser inspection failed." };
    }
    return {
      success: true,
      data: {
        url: res.url,
        statusCode: res.statusCode,
        title: res.title,
        markdown: res.markdown,
        linkCount: res.links?.length ?? 0,
        links: res.links,
      },
    };
  },
};

export const browserReadPageTool: TallaTool = {
  name: "browserReadPage",
  description:
    "Read the rendered markdown content of a PUBLIC web page with a real headless browser (Cloudflare Browser Run). Returns the page text only (no links). READ-ONLY — never submits forms, logs in, or changes anything. Blocked for internal/private/credential URLs.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Fully-qualified public http(s) URL to read." },
    },
    required: ["url"],
  },
  execute: async (args, ctx) => {
    if (!roleGate(ctx as { role?: string | null })) {
      return { success: false, error: "Browser reading is restricted to owner/admin roles." };
    }
    const browser = (ctx as unknown as { env: { BROWSER?: BrowserRunBinding } }).env?.BROWSER;
    if (!browser) {
      return { success: false, error: "Browser Run binding is not configured." };
    }
    const url = (args.url as string) || "";
    const startedAt = new Date().toISOString();
    const res = await readPage(browser, url);
    await logBrowser(ctx.db, {
      tenantId: ctx.tenantId,
      requestedBy: ctx.role ?? "unknown",
      trigger: "chat",
      url,
      domain: safeDomainLog(url),
      action: "read",
      startedAt,
      completedAt: new Date().toISOString(),
      success: res.ok ? 1 : 0,
      statusCode: res.statusCode ?? null,
      error: res.error ?? null,
      resultMeta: JSON.stringify({ title: res.title ?? null }),
    });
    if (!res.ok) {
      return { success: false, error: res.error || "Browser read failed." };
    }
    return {
      success: true,
      data: { url: res.url, statusCode: res.statusCode, title: res.title, markdown: res.markdown },
    };
  },
};
