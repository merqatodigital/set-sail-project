import { supabase, isSupabaseConnected } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// TALA's agent graph — the KAPWA Resort OS pipeline (classify → agent →
// audit) ported natively from packages/agent-core (graph.py, nodes/classify,
// nodes/audit, prompts/classify.py). LangGraph itself is Python-only; the
// graph here is the same three-node flow expressed directly:
//
//   guest message → [classify] → [agent + tools] → [audit] → reply
//
// classify: one cheap LLM call that tags intent / department / urgency,
//           with deterministic keyword fallback so a rate-limited free
//           model can never block the answer.
// agent:    the tool-calling loop in useTalaChat (unchanged home).
// audit:    every completed turn is recorded to tala_audit_log — KAPWA's
//           audit-trail rule ("log every significant action") applied to
//           the guest-facing agent.
// ---------------------------------------------------------------------------

export interface TalaClassification {
  intent: string;
  urgency: string;
  department: string;
}

export const DEFAULT_CLASSIFICATION: TalaClassification = {
  intent: "general",
  urgency: "normal",
  department: "guest_relations",
};

/** Ported from KAPWA prompts/classify.py, trimmed to the guest-facing fields. */
export const TALA_CLASSIFY_PROMPT = `You are a resort intent classifier. Analyze the guest message and classify it.

Return a JSON object with these exact fields:
- intent: one of [guest_request, booking_inquiry, maintenance_request, complaint, information_request, financial_question, general]
- urgency: one of [low, normal, high, urgent]
- department: one of [guest_relations, reservations, front_desk, housekeeping, maintenance, finance]

Classification rules:
- Booking, availability, or date questions → booking_inquiry, department reservations
- "How much" / price / cost / bill → financial_question, department finance
- AC/electrical/plumbing/broken things → maintenance_request, urgency high, department maintenance
- Complaints about service → complaint, department guest_relations
- Wifi, rooms, facilities, local info → information_request, department front_desk
- Anything else → general, department guest_relations

Return ONLY valid JSON, no other text.`;

const INTENTS = new Set([
  "guest_request",
  "booking_inquiry",
  "maintenance_request",
  "complaint",
  "information_request",
  "financial_question",
  "general",
]);
const URGENCIES = new Set(["low", "normal", "high", "urgent"]);
const DEPARTMENTS = new Set([
  "guest_relations",
  "reservations",
  "front_desk",
  "housekeeping",
  "maintenance",
  "finance",
]);

/** Deterministic fallback — KAPWA's classification rules as keyword checks. */
export function classifyHeuristically(text: string): TalaClassification {
  const t = text.toLowerCase();
  if (/\b(book|booking|available|availability|reserve|check[- ]?in|stay|night)\b/.test(t)) {
    return { intent: "booking_inquiry", urgency: "normal", department: "reservations" };
  }
  if (/\b(price|cost|how much|bill|rate|fee|payment|refund)\b/.test(t)) {
    return { intent: "financial_question", urgency: "normal", department: "finance" };
  }
  if (/\b(broken|leak|aircon|a\/c|ac unit|plumbing|electrical|repair|not working)\b/.test(t)) {
    return { intent: "maintenance_request", urgency: "high", department: "maintenance" };
  }
  if (/\b(complain|complaint|disappointed|terrible|unacceptable|refund)\b/.test(t)) {
    return { intent: "complaint", urgency: "high", department: "guest_relations" };
  }
  if (/\b(wifi|internet|speed|room|facilities|kitchen|workspace|where|what time|open)\b/.test(t)) {
    return { intent: "information_request", urgency: "normal", department: "front_desk" };
  }
  return DEFAULT_CLASSIFICATION;
}

/** Parse the classifier's JSON, tolerating chatter around it; validate enums. */
export function parseClassification(raw: string | null | undefined): TalaClassification | null {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const intent = String(parsed.intent ?? "");
    const urgency = String(parsed.urgency ?? "");
    const department = String(parsed.department ?? "");
    if (!INTENTS.has(intent) || !URGENCIES.has(urgency) || !DEPARTMENTS.has(department)) {
      return null;
    }
    return { intent, urgency, department };
  } catch {
    return null;
  }
}

export interface TalaAuditEntry {
  classification: TalaClassification;
  guestMessage: string;
  replyPreview: string;
  toolsUsed: string[];
  sentiment?: string;
}

/**
 * Audit node — fire-and-forget so logging can never delay or break the
 * guest's answer. INSERT-only from the browser (same policy story as
 * tala_leads: anon can add rows, never alter or read others' details away).
 */
export function writeAuditEntry(entry: TalaAuditEntry): void {
  if (!isSupabaseConnected() || !supabase) return;
  void (async () => {
    try {
      await supabase.from("tala_audit_log").insert({
        intent: entry.classification.intent,
        urgency: entry.classification.urgency,
        department: entry.classification.department,
        guest_message: entry.guestMessage.slice(0, 500),
        reply_preview: entry.replyPreview.slice(0, 300),
        tools_used: entry.toolsUsed,
        sentiment: entry.sentiment || "neutral",
      });
    } catch {
      /* audit must never break the conversation */
    }
  })();
}
