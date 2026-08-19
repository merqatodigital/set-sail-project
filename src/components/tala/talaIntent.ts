// ---------------------------------------------------------------------------
// TALA intent contract — the shape every public CTA uses to open the widget
// with a structured goal instead of a free-form chat prompt. The widget reads
// the intent and renders a focused form when one is available (Day Pass first),
// otherwise it prefills the chat with a clear message so the Cloudflare
// TallaAgent routes the guest correctly.
//
// Intents surface on the widget as RICH FLOWS (e.g. workspace_day_pass opens a
// structured modal) and as ROUTING HINTS for the chat fallback.
// ---------------------------------------------------------------------------

export type TalaIntentKind =
  | "workspace_day_pass"
  | "room_booking"
  | "package_booking"
  | "general_help"
  | "amuma_investment";

/** Optional contextual data a CTA can hand the widget for a given intent. */
export interface TalaIntentContext {
  /** Day Pass: the roomType string stored in tala_booking_requests. */
  roomType?: string;
  /** Room booking: pre-filled dates (ISO YYYY-MM-DD) and guest count. */
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /** Package booking: the package name as listed in cms_data. */
  packageName?: string;
  /** Stay plan booking: the advertised pricing-plan name (e.g. "Weekly Sprint"). */
  stayPlan?: string;
  /** Stay length in nights, taken from the offer's structured CMS duration. */
  nights?: number;
  /** Where the click came from (section or page id) — context only. */
  source?: string;
  /** What the visitor is broadly after when no exact offer was clicked. */
  interest?: "workspace" | "long_stay" | "general" | "investment";
}

export interface TalaIntentPayload {
  kind: TalaIntentKind;
  /** Human message TALA should see when the flow falls back to chat. */
  message?: string;
  context?: TalaIntentContext;
}

/**
 * Turn a raw intent object (typed at call sites, may be a partial from old
 * `openTala(string)` callers) into a well-formed payload the widget can trust.
 */
export function normalizeIntent(input: string | TalaIntentPayload | undefined): TalaIntentPayload | null {
  if (typeof input === "string") {
    if (!input.trim()) return null;
    return { kind: "general_help", message: input.trim() };
  }
  if (!input || typeof input !== "object") return null;
  return {
    kind: input.kind,
    message: input.message?.trim() || undefined,
    context: input.context ?? {},
  };
}

/**
 * Message a CTA sends when it already knows the guest's goal but didn't pass
 * copy of its own. Keeps transactional CTAs from opening a vague generic chat.
 */
export function intentMessage(intent: TalaIntentPayload): string | undefined {
  if (intent.message?.trim()) return intent.message.trim();
  const c = intent.context ?? {};
  switch (intent.kind) {
    case "room_booking": {
      const room = c.roomType ? ` ${c.roomType}` : " a stay";
      const dates = c.checkIn && c.checkOut ? ` from ${c.checkIn} to ${c.checkOut}` : "";
      const guests = c.guests ? ` for ${c.guests} guest(s)` : "";
      return `Hi TALA! I'd like to check availability and book${room}${dates}${guests}.`;
    }
    case "package_booking":
      return `Hi TALA! I'd like to book the ${c.stayPlan || c.packageName || "package"}${c.stayPlan ? " stay plan" : ""}.`;
    case "workspace_day_pass":
      return "Hi TALA! I'd like a Workspace Day Pass.";
    case "amuma_investment":
      return "Hi TALA! I'm interested in the AMUMA Circle investment opportunity. Could you tell me about the membership tiers and how to apply?";
    case "general_help":
    default:
      return c.interest === "long_stay"
        ? "Hi TALA! I'm interested in an extended stay — can you help me pick the right room or plan?"
        : undefined;
  }
}

/**
 * The EXACT item the visitor clicked — room name, advertised stay plan or
 * all-inclusive package. Empty string when the CTA carried no selection
 * (e.g. the closing "Book Now" button), in which case TALA/the form asks.
 */
export function intentOfferLabel(intent: TalaIntentPayload | null | undefined): string {
  const c = intent?.context ?? {};
  return (c.packageName || c.stayPlan || c.roomType || "").trim();
}

/** How the selected offer should be labelled in the form and in the request. */
export function intentOfferKind(
  intent: TalaIntentPayload | null | undefined,
): "room" | "plan" | "package" | "none" {
  const c = intent?.context ?? {};
  if (c.packageName) return "package";
  if (c.stayPlan) return "plan";
  if (c.roomType) return "room";
  return "none";
}