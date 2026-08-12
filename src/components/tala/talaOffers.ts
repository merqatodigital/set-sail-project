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
}

/** Every bookable offer currently advertised on the site. */
export function listOffers(cms: CmsData): Offer[] {
  const rooms = (cms.homepage?.rooms ?? [])
    .filter((r) => r.visible !== false)
    .map<Offer>((r) => ({ label: r.name, kind: "room" }));
  const plans = (cms.pricing ?? [])
    .filter((p) => !/day\s*pass/i.test(p.name))
    .map<Offer>((p) => ({ label: p.name, kind: "plan" }));
  const packages = (cms.packages ?? []).map<Offer>((p) => ({ label: p.name, kind: "package" }));
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
  if (offer.kind === "package") return { packageName: offer.label };
  if (offer.kind === "plan") return { stayPlan: offer.label };
  return { roomType: offer.label };
}

const BOOKING_RE =
  /\b(book|reserve|reservation|i(?:'| a)?m interested in|i want|i'd like|sign me up|take the)\b/i;

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
  if (!text || !BOOKING_RE.test(text)) return null;
  if (/\?\s*$/.test(text) && !/\b(book|reserve)\b/i.test(text)) return null;

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