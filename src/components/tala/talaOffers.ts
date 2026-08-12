// ---------------------------------------------------------------------------
// Live offer catalogue helpers. Everything here is derived from the CMS /
// database content that already powers the public site — no hard-coded rooms,
// plans, packages or prices. Used by the in-chat booking form (offer selector
// when the CTA carried no selection) and by the conversation -> form
// escalation, so TALA can only ever offer things the site actually sells.
// ---------------------------------------------------------------------------

import type { CmsData } from "@/types/cms";
import type { TalaIntentPayload, TalaIntentContext } from "./talaIntent";

export type OfferKind = "room" | "plan" | "package";

export interface Offer {
  label: string;
  kind: OfferKind;
  /** Stay length in nights, taken from the offer's own structured CMS field. */
  nights: number;
}

/**
 * Nights for an offer, derived from the STRUCTURED CMS duration field
 * (`period`: "3 days", "/week", "/month"), never from the display title.
 */
export function nightsFromPeriod(period: string | undefined | null): number {
  const p = (period || "").toLowerCase();
  const days = p.match(/(\d+)\s*-?\s*day/);
  if (days) return Math.max(1, Number(days[1]));
  if (/month/.test(p)) return 30;
  if (/week/.test(p)) return 7;
  return 1;
}

/** Every bookable offer currently advertised on the site. */
export function listOffers(cms: CmsData): Offer[] {
  const rooms = (cms.homepage?.rooms ?? [])
    .filter((r) => r.visible !== false)
    .map<Offer>((r) => ({ label: r.name, kind: "room", nights: 1 }));
  const plans = (cms.pricing ?? [])
    .filter((p) => !/day\s*pass/i.test(p.name))
    .map<Offer>((p) => ({ label: p.name, kind: "plan", nights: nightsFromPeriod(p.period) }));
  const packages = (cms.packages ?? []).map<Offer>((p) => ({
    label: p.name,
    kind: "package",
    nights: nightsFromPeriod(p.period),
  }));
  const seen = new Set<string>();
  return [...rooms, ...plans, ...packages].filter((o) => {
    const key = `${o.kind}:${o.label.toLowerCase()}`;
    if (!o.label.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Context patch for a chosen offer, matching the intent contract. */
export function offerContext(offer: Offer): TalaIntentContext {
  if (offer.kind === "package") return { packageName: offer.label, nights: offer.nights };
  if (offer.kind === "plan") return { stayPlan: offer.label, nights: offer.nights };
  return { roomType: offer.label, nights: offer.nights };
}

// An explicit booking ACTION. Merely naming an offer is not enough.
const ACTION_RE =
  /\b(book|booking|reserve|reservation|i want|i'd like|i would like|sign me up|i'?ll take|take the|choose|select|let'?s do)\b/i;

// Informational phrasing — questions ABOUT an offer must stay conversational.
const QUESTION_START_RE =
  /^(what|what's|whats|how|is|are|does|do you|can you|could you|when|where|which|why|who|any|tell me|explain)\b/i;
const INFO_RE = /\b(included|include|includes|how much|price|cost|available|availability|difference)\b/i;

/**
 * Escalation detector: a typed message that clearly asks to book AND names an
 * offer the site actually advertises becomes the structured booking form, so a
 * conversation can turn into a real request without re-asking anything.
 * Returns null for questions ("what is the internet like?") and vague chatter.
 */
export function detectBookingIntent(
  message: string,
  cms: CmsData,
): TalaIntentPayload | null {
  const text = (message || "").trim();
  if (!text) return null;
  // Questions and informational asks never escalate.
  if (/\?\s*$/.test(text)) return null;
  if (QUESTION_START_RE.test(text)) return null;
  if (!ACTION_RE.test(text)) return null;
  if (INFO_RE.test(text)) return null;

  const lower = text.toLowerCase();
  if (/day\s*pass/.test(lower)) {
    return { kind: "workspace_day_pass", context: { roomType: "Day Pass", source: "chat" } };
  }

  // Longest matching offer name wins ("7-Day All-Inclusive" over "Day").
  const match = listOffers(cms)
    .filter((o) => o.label.length >= 4 && lower.includes(o.label.toLowerCase()))
    .sort((a, b) => b.label.length - a.label.length)[0];
  if (!match) return null;

  return {
    kind: match.kind === "room" ? "room_booking" : "package_booking",
    context: { ...offerContext(match), source: "chat" },
  };
}