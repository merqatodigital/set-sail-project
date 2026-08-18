// Server-side turn router — a deterministic, NO-extra-LLM heuristic that decides
// how a guest/owner message should be executed before we touch the agent loop.
//
// Three modes:
//   deterministic   -> handled by tryDeterministicActions (food/reception/DayPass)
//   conversational  -> ONE LLM call, NO tools (greetings, property/knowledge Qs)
//   agentic         -> full multi-hop tool loop (live lookups, bookings, approvals)
//
// The goal: normal voice conversation must not pay the cost of a 5-hop tool
// orchestration loop. Routing is pure + testable; it never calls the model.
//
// Precedence matters: ACTION_RE / INTENT_RE (explicit action verbs and
// natural-language booking/order intent) are checked BEFORE GREETING_RE and
// PROPERTY_FAQ_RE. Otherwise a real request like "room for 4 this weekend"
// gets caught by PROPERTY_FAQ_RE's bare "room" match and silently loses tool
// access instead of reaching the agentic path.

export type TurnMode = "conversational" | "agentic";

// Guest/owner actions that genuinely require live operational tools or state
// changes. Anything matching this is routed to the agentic path even if short.
const ACTION_RE =
  /\b(book|reserve|cancel|order|request|approve|reject|modify|change|update|create|delete|send|schedule|pay|refund|availability|arrivals|departures|in-house|occupancy|operations|bookings|status|what.*(arrivals|departures|bookings)|today.*arrivals|today.*departures|day pass|check (my|the) (booking|reservation|status))\b/i;

// Natural-language booking/order intent that doesn't use an explicit action
// verb — e.g. "room for 4 this weekend", "table for two tonight", "any
// vacancies?", "do you have a room". Without this, ACTION_RE misses the
// request and PROPERTY_FAQ_RE's bare "room"/"table" match wins instead,
// silently routing a real booking attempt to the no-tools conversational
// path. Checked before PROPERTY_FAQ_RE for the same reason.
const INTENT_RE =
  /\b(vacan(?:cy|cies|t)|any (?:rooms?|availability|vacanc(?:y|ies))|do you have (?:a |any )?(?:room|table|space|availability)|(?:room|table|space|spot) for \S+|party of \d+|\d+\s*(?:people|pax|persons?|guests?|of us)|(?:want|need|looking) (?:to|for) (?:book|reserve|stay|a room|a table)|interested in (?:booking|staying|reserving)|planning to stay|check(?:ing)? (?:us|me) in)\b/i;

// Greetings / casual chatter — always safe to answer with one model call.
const GREETING_RE =
  /\b(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo|sup|thanks|thank you|ok|okay|sure|bye|goodbye|see you|welcome|nice|cool|great|awesome|haha|lol)\b/i;

// Property / knowledge questions that only need the live system prompt (no
// external tool). These are the bulk of normal resort conversation.
const PROPERTY_FAQ_RE =
  /\b(wifi|wi-fi|internet|password|breakfast|menu|food|restaurant|bar|pool|beach|location|address|direction|checkin|check-in|checkout|check-out|parking|pet|dog|child|kid|family|hour|open|close|price|cost|rate|fee|tour|activity|island|snorkel|kayak|room|amenit|facilit|quiet|noise|view|balcon|rooftop|workspace|cowork|laundry|towel|pillow|aircon|air con|ac\b|policy|rule|tip|recommend|suggest|what (is|are|time|kind|type)|where|how (much|far|long|do i|can i)|tell me about|do you (have|offer))\b/i;

/**
 * Decide whether a message is a simple conversational turn (one LLM call, no
 * tools) or requires the agentic tool loop. `deterministic` matches are handled
 * separately by tryDeterministicActions and never reach here.
 */
export function classifyTurn(message: string): TurnMode {
  const m = (message || "").trim();
  if (!m) return "conversational";

  // Any clear action verb, or natural-language booking/order intent -> agentic
  // (needs tools / live state). Checked before FAQ so "room for 4" isn't
  // swallowed by PROPERTY_FAQ_RE's bare "room" match.
  if (ACTION_RE.test(m) || INTENT_RE.test(m)) return "agentic";

  // Explicit greeting or property/knowledge question -> conversational.
  if (GREETING_RE.test(m)) return "conversational";
  if (PROPERTY_FAQ_RE.test(m)) return "conversational";

  // Fallback: short casual messages without action verbs are conversational.
  // Long, complex, or ambiguous messages go agentic (the model may need tools).
  const wordCount = m.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 14) return "conversational";
  return "agentic";
}

/**
 * Resolve the TRUSTED chat identity from server authentication. The browser
 * `role` field is NEVER trusted. An unauthenticated request (or one that
 * forges role:"owner"/"admin" in the body) is always routed as `guest`.
 *
 * Returns the effective tenantId, stable userId, role, and the Durable Object
 * key used for routing/isolation.
 */
export interface ChatIdentity {
  tenantId: string;
  userId: string | null;
  role: "guest" | "owner" | "admin";
  doKey: string;
}

export function resolveChatIdentity(
  auth: { authenticated: boolean; userId: string | null; tenantId: string | null; role: string | null },
  body: { tenantId?: string; userId?: string; role?: string },
): ChatIdentity {
  const isPrivileged =
    auth.authenticated &&
    (auth.role === "owner" || auth.role === "admin") &&
    !!auth.tenantId;

  if (isPrivileged) {
    const tenantId = auth.tenantId as string;
    const role = auth.role as "owner" | "admin";
    // Owner/admin share ONE conversation per tenant.
    return { tenantId, userId: auth.userId, role, doKey: tenantId };
  }

  // Unauthenticated OR forged role -> strict guest. The body.role is ignored.
  const tenantId = body.tenantId || "";
  const userId = body.userId || null;
  // Guest isolation: tenantId:userId so two visitors never share history.
  const doKey = `${tenantId}:${userId || "anon"}`;
  return { tenantId, userId, role: "guest", doKey };
}
