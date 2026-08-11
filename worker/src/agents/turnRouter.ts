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

export type TurnMode = "conversational" | "agentic";

// Guest/owner actions that genuinely require live operational tools or state
// changes. Anything matching this is routed to the agentic path even if short.
const ACTION_RE =
  /\b(book|reserve|cancel|order|request|approve|reject|modify|change|update|create|delete|send|schedule|pay|refund|availability|book a|book the|my booking|my reservation|my stay|check (my|the) (booking|reservation|status)|day pass|place an order|add (a |the )?request|report (a |the )?(issue|problem)|open (a |the )?(ticket|task))\b/i;

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

  // Any clear action verb -> agentic (needs tools / live state).
  if (ACTION_RE.test(m)) return "agentic";

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
