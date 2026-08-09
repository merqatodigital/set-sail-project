// Cloudflare AI Search integration for the existing TallaAgent.
//
// AI Search is an ADDITIONAL knowledge source (unstructured docs / SOP / guides),
// not a second brain. Structured live facts (availability, balances, arrivals)
// come from D1/Supabase tools; current public-web info uses Browser Run.
//
// Accessed via the Cloudflare AI Search REST API (account-scoped). All
// account/index/token values come from env (wrangler secrets/vars) — never
// hardcoded. The index + corpus must be created externally (see README in
// worker/ai-search-corpus/); this module degrades gracefully when absent.

import type { TallaTool } from "../types.js";
import { logAISearch } from "../../db/repos/aiSearchRepo.js";

export interface AISearchEnv {
  AI_SEARCH_ACCOUNT_ID?: string;
  AI_SEARCH_INDEX?: string;
  AI_SEARCH_TOKEN?: string;
}

export interface AISearchPassage {
  text: string;
  score?: number;
  source?: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface AISearchResult {
  ok: boolean;
  query: string;
  passages: AISearchPassage[];
  error?: string;
  rawStatus?: number;
}

function isConfigured(env: AISearchEnv): boolean {
  return Boolean(env.AI_SEARCH_ACCOUNT_ID && env.AI_SEARCH_INDEX && env.AI_SEARCH_TOKEN);
}

/**
 * Query the Cloudflare AI Search index. Returns grounded passages with source
 * metadata. On any failure reports the real error (never hallucinates content).
 */
export async function searchResortKnowledge(
  env: AISearchEnv,
  query: string,
  opts: { role?: string | null; maxResults?: number; category?: string } = {},
): Promise<AISearchResult> {
  if (!query || !query.trim()) {
    return { ok: false, query, passages: [], error: "Empty query" };
  }
  if (!isConfigured(env)) {
    return { ok: false, query, passages: [], error: "AI Search is not configured." };
  }

  const accountId = env.AI_SEARCH_ACCOUNT_ID!.trim();
  const index = env.AI_SEARCH_INDEX!.trim();
  const token = env.AI_SEARCH_TOKEN!.trim();
  const maxResults = Math.min(Math.max(opts.maxResults ?? 5, 1), 10);

  // Role enforcement: guests only see guest-safe (audience=guest) docs.
  // Owners/admins may see operational/SOP docs too.
  const role = opts.role ?? "guest";
  const metadataFilter =
    role === "guest"
      ? { audience: "guest" }
      : undefined; // owner/admin: no audience restriction (index may still tag)

  const body: Record<string, unknown> = {
    query: query.trim(),
    max_num_results: maxResults,
  };
  if (metadataFilter) body.metadata_filter = metadataFilter;
  if (opts.category) body.metadata_filter = { ...(metadataFilter as object), category: opts.category };

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/${encodeURIComponent(
    index,
  )}/search`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, query, passages: [], error: `AI Search request failed: ${(e as Error).message}` };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // Common external-blocker cases reported clearly (no hallucination).
    let msg = `AI Search returned HTTP ${res.status}`;
    if (res.status === 404) msg = "AI Search index not found (create it in the Cloudflare dashboard).";
    else if (res.status === 403) msg = "AI Search token lacks permission for this index.";
    else if (txt) msg += `: ${txt.slice(0, 160)}`;
    return { ok: false, query, passages: [], error: msg, rawStatus: res.status };
  }

  try {
    const data = (await res.json()) as {
      success?: boolean;
      result?: AISearchPassage[] | { passages?: AISearchPassage[] };
    };
    // AI Search returns `result` as an array of passages.
    const passages = Array.isArray(data.result)
      ? data.result
      : ((data.result as { passages?: AISearchPassage[] } | undefined)?.passages ?? []);
    const clean = passages
      .filter((p) => p && typeof p.text === "string" && p.text.trim().length > 0)
      .map((p) => ({
        text: p.text.trim().slice(0, 800),
        score: typeof p.score === "number" ? p.score : undefined,
        source: p.source ?? p.url ?? p.title ?? undefined,
        url: p.url ?? undefined,
        title: p.title ?? undefined,
        metadata: p.metadata,
      }));
    return { ok: true, query, passages: clean };
  } catch (e) {
    return { ok: false, query, passages: [], error: `Failed to parse AI Search response: ${(e as Error).message}` };
  }
}

const roleGate = (role?: string | null): boolean =>
  role === "owner" || role === "admin" || role === "guest" || role === "system";

export const searchResortKnowledgeTool: TallaTool = {
  name: "searchResortKnowledge",
  description:
    "Search the resort's indexed SOP, policies, guides, and long-form documentation (property info, guest policies, check-in/out, Starlink/WiFi guidance, transport/arrival guides, tours, kitchen/house rules, staff procedures). Use this for UNSTRUCTURED knowledge questions — NOT for live availability, balances, or arrivals (use the live operational tools for those) and NOT for checking the public website (use the browser tool). Returns grounded passages with source metadata. If nothing relevant is found, it will say so rather than inventing policy.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural-language knowledge question (e.g. 'What is the procedure if Starlink fails?')." },
      category: { type: "string", description: "Optional filter (e.g. 'starlink', 'kitchen', 'transport', 'house-rules', 'maintenance')." },
    },
    required: ["query"],
  },
  execute: async (args, ctx) => {
    const env = (ctx as unknown as { env: AISearchEnv }).env;
    const query = (args.query as string) || "";
    const category = (args.category as string | undefined) || undefined;
    const role = ctx.role;
    if (!roleGate(role)) {
      return { success: false, error: "Knowledge search is unavailable for this role." };
    }

    const started = Date.now();
    const result = await searchResortKnowledge(env, query, {
      role,
      category: category || undefined,
      maxResults: 5,
    });
    const durationMs = Date.now() - started;

    // Audit (best-effort; never blocks the answer).
    try {
      await logAISearch(ctx.db, {
        tenantId: ctx.tenantId,
        requestedBy: role ?? "unknown",
        query,
        category: category ?? null,
        resultCount: result.passages.length,
        durationMs,
        success: result.ok ? 1 : 0,
        error: result.error ?? null,
      });
    } catch {
      /* audit failure must not break the tool */
    }

    if (!result.ok) {
      return { success: false, error: result.error || "AI Search failed." };
    }
    if (result.passages.length === 0) {
      return {
        success: true,
        data: {
          query,
          found: false,
          message: "No grounded information found in the resort knowledge base for that question.",
        },
      };
    }
    return {
      success: true,
      data: {
        query,
        found: true,
        passages: result.passages.map((p) => ({
          text: p.text,
          score: p.score,
          source: p.source,
          url: p.url,
          title: p.title,
        })),
      },
    };
  },
};
