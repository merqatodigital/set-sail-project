// Server-side resort knowledge retrieval for TallaAgent.
//
// This is the ONLY place the Cloudflare Worker reads public.tala_knowledge.
// It also reads the public website offer catalog from cms_data so TALA knows
// the exact stay plans and all-inclusive packages that its own CTAs advertise.
// Both reads run inside the Worker with server-side credentials and are cached.

import type { Env } from "../env.js";

export interface ResortKnowledgeEntry {
  id: string;
  topic: string;
  label: string;
  body: string;
  tags: string;
}

// Per-isolate cache. These rows change only when the owner edits Admin/CMS.
// Never let a Supabase read hold a guest reply hostage indefinitely.
const KNOWLEDGE_TTL_MS = 5 * 60 * 1000;
const KNOWLEDGE_TIMEOUT_MS = 2500;
const knowledgeCache = new Map<string, { at: number; rows: ResortKnowledgeEntry[] }>();

function cleanSecret(value: string | undefined): string {
  return value ? value.replace(/^["']|["']$/g, "").trim() : "";
}

function money(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `₱${value.toLocaleString("en-PH")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return "price not set";
  if (/^[₱$]/.test(text)) return text;
  if (/^\d[\d,.]*$/.test(text)) return `₱${text}`;
  return text;
}

function featureText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: unknown }).text ?? "").trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("; ");
}

function buildOfferKnowledge(cmsValue: unknown): ResortKnowledgeEntry | null {
  if (!cmsValue || typeof cmsValue !== "object") return null;
  const cms = cmsValue as Record<string, unknown>;
  const lines: string[] = [];

  const pricing = Array.isArray(cms.pricing) ? cms.pricing : [];
  for (const raw of pricing) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    const period = String(item.period ?? "").trim();
    const description = String(item.description ?? "").trim();
    const features = featureText(item.features);
    lines.push(
      [
        `${name}: ${money(item.price)}${period ? ` ${period}` : ""}.`,
        description,
        features ? `Includes: ${features}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const packages = Array.isArray(cms.packages) ? cms.packages : [];
  for (const raw of packages) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    const period = String(item.period ?? "").trim();
    const description = String(item.description ?? "").trim();
    const features = featureText(item.features);
    const one = money(item.price);
    const twoRaw = Number(item.priceTwo ?? 0);
    const two = Number.isFinite(twoRaw) && twoRaw > 0 ? money(twoRaw) : "";
    const tierText = two
      ? `1 person ${one}; 2 people ${two}${period ? ` / ${period}` : ""}.`
      : `${one}${period ? ` / ${period}` : ""}.`;
    lines.push(
      [
        `${name}: ${tierText}`,
        description,
        features ? `Includes: ${features}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (!lines.length) return null;

  return {
    id: "cms-current-offers",
    topic: "current_offers",
    label: "Current Website Stay Plans and Packages",
    tags: "pricing,packages,stay,booking,cta,current",
    body: [
      "These are ACTIVE Marina Terrace offers currently displayed on the public website. Treat these names and prices as authoritative website/CMS data, not as claims made by the guest. Never tell a guest that one of these offers does not exist while it is listed here.",
      ...lines,
      "When a guest arrives from a package/stay CTA, acknowledge the selected offer immediately. If they want to book it, collect only the missing booking fields (name, email, WhatsApp/mobile, check-in, check-out, guests) and create the normal pending booking request. Use the selected offer name in the booking roomType/plan field so staff can see exactly which website offer the guest chose. Do not substitute an unrelated tour or service.",
    ].join("\n"),
  };
}

async function fetchCmsOfferKnowledge(base: string, key: string): Promise<ResortKnowledgeEntry | null> {
  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/cms_data`);
  url.searchParams.set("select", "value");
  url.searchParams.set("key", "eq.marina_terrace_payload");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(KNOWLEDGE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[knowledge] cms_data responded ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as Array<{ value?: unknown }>;
    return buildOfferKnowledge(rows[0]?.value);
  } catch (err) {
    console.error("[knowledge] cms_data offer fetch failed:", err);
    return null;
  }
}

/**
 * Retrieve enabled knowledge for a single resort, ordered by sort_order, and
 * append the live website stay/package catalog for Marina Terrace.
 */
export async function getResortKnowledge(
  env: Env,
  resortId: string,
): Promise<ResortKnowledgeEntry[]> {
  const cached = knowledgeCache.get(resortId);
  if (cached && Date.now() - cached.at < KNOWLEDGE_TTL_MS) return cached.rows;

  const base = cleanSecret(env.SUPABASE_URL);
  const key = cleanSecret(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY);
  if (!base || !key) {
    console.warn("[knowledge] Supabase URL/key not configured; skipping knowledge load.");
    return cached?.rows ?? [];
  }

  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/tala_knowledge`);
  url.searchParams.set("select", "id,topic,label,body,tags");
  url.searchParams.set("resort_id", `eq.${resortId}`);
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("order", "sort_order.asc");

  try {
    // Run the stable knowledge and live website-offer reads in parallel so the
    // package fix does not add a serial network hop to TALA's first token.
    const [knowledgeResult, offerKnowledge] = await Promise.all([
      fetch(url.toString(), {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(KNOWLEDGE_TIMEOUT_MS),
      }),
      resortId === "marina_terrace" ? fetchCmsOfferKnowledge(base, key) : Promise.resolve(null),
    ]);

    let mapped: ResortKnowledgeEntry[] = cached?.rows?.filter((r) => r.id !== "cms-current-offers") ?? [];
    if (knowledgeResult.ok) {
      const rows = (await knowledgeResult.json()) as Array<Record<string, unknown>>;
      mapped = rows.map((r) => ({
        id: String(r.id ?? ""),
        topic: String(r.topic ?? ""),
        label: String(r.label ?? ""),
        body: String(r.body ?? ""),
        tags: String(r.tags ?? ""),
      }));
    } else {
      console.error(`[knowledge] Supabase responded ${knowledgeResult.status}`);
    }

    if (offerKnowledge) mapped.push(offerKnowledge);
    else if (cached) {
      const previousOffer = cached.rows.find((r) => r.id === "cms-current-offers");
      if (previousOffer) mapped.push(previousOffer);
    }

    knowledgeCache.set(resortId, { at: Date.now(), rows: mapped });
    return mapped;
  } catch (err) {
    console.error("[knowledge] fetch failed:", err);
    return cached?.rows ?? [];
  }
}
