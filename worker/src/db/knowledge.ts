// Server-side resort knowledge retrieval for TallaAgent.
//
// This is the ONLY place the Cloudflare Worker reads public.tala_knowledge.
// It runs inside the Worker (never in the browser), scopes every query to the
// current resort/tenant, and returns enabled knowledge rows for injection into
// the existing TallaAgent system prompt. Supabase remains the source of truth;
// we never copy knowledge into D1.
//
// Auth: uses the SUPABASE_SERVICE_ROLE_KEY bound secret (server-side only).
// The service-role key bypasses RLS, which is acceptable here because this is a
// trusted backend read scoped by resort_id — it is never exposed to the client.

import type { Env } from "../env.js";

export interface ResortKnowledgeEntry {
  id: string;
  topic: string;
  label: string;
  body: string;
  tags: string;
}

/**
 * Retrieve enabled knowledge for a single resort, ordered by sort_order.
 *
 * @param env        Worker bindings (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * @param resortId   canonical resort/tenant identifier (e.g. "marina_terrace")
 */
export async function getResortKnowledge(
  env: Env,
  resortId: string,
): Promise<ResortKnowledgeEntry[]> {
  const baseRaw = env.SUPABASE_URL;
  // Knowledge read is a scoped, read-only query (resort_id + enabled) that runs
  // only inside the Worker. The anon key has no Data API grant on
  // public.tala_knowledge (it returns HTTP 401), so prefer the server-side
  // service-role secret and fall back to anon only if it is unset.
  const keyRaw = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  // Secrets are sometimes stored with surrounding quotes (e.g. when set via
  // `wrangler secret put` with a quoted shell value). Strip a single pair of
  // enclosing quotes and trim whitespace so the URL/key parse correctly.
  const base = baseRaw ? baseRaw.replace(/^["']|["']$/g, "").trim() : "";
  const key = keyRaw ? keyRaw.replace(/^["']|["']$/g, "").trim() : "";
  if (!base || !key) {
    // Supabase not configured for this Worker — degrade gracefully (no knowledge).
    console.warn("[knowledge] Supabase URL/key not configured; skipping knowledge load.");
    return [];
  }

  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/tala_knowledge`);
  url.searchParams.set("select", "id,topic,label,body,tags");
  url.searchParams.set("resort_id", `eq.${resortId}`);
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("order", "sort_order.asc");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.error(`[knowledge] Supabase responded ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      topic: String(r.topic ?? ""),
      label: String(r.label ?? ""),
      body: String(r.body ?? ""),
      tags: String(r.tags ?? ""),
    }));
  } catch (err) {
    console.error("[knowledge] fetch failed:", err);
    return [];
  }
}
