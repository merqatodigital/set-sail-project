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
  | "general_help";

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
      return `Hi TALA! I'd like to book the ${c.packageName || "package"}.`;
    case "workspace_day_pass":
      return "Hi TALA! I'd like a Workspace Day Pass.";
    case "general_help":
    default:
      return undefined;
  }
}