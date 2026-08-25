// Lightweight global bus so any public CTA can open the TALA chat widget and
// request a structured workflow (Day Pass form, room booking, etc.). CTAs call
// openTala(message?, intent?) or openTala({ kind, context }). The widget
// subscribes on mount; calling openTala again targets the live widget and new
// listeners replace the old one (single-instance widget). Keeps CTAs decoupled
// from the widget instance.

import type { TalaIntentPayload, TalaIntentKind, TalaIntentContext } from "./talaIntent";

/** Listener signature: message + optional intent payload. */
type Listener = (message: string | undefined, intent: TalaIntentPayload | null) => void;

let listener: Listener | null = null;
/**
 * The widget is lazy-loaded, so CTAs can fire before it mounts (common on
 * mobile, where the chunk arrives late). Queue the last request and replay it
 * as soon as the widget registers its listener, so no CTA is ever dropped.
 */
let pending: { message?: string; intent: TalaIntentPayload | null } | null = null;

export function setTalaOpenListener(fn: Listener | null) {
  listener = fn;
  if (fn && pending) {
    const queued = pending;
    pending = null;
    // Defer so the widget finishes mounting before it reacts.
    setTimeout(() => fn(queued.message, queued.intent), 0);
  }
}

export function openTala(message?: string, intent?: TalaIntentPayload): void;
export function openTala(intent: TalaIntentPayload): void;
export function openTala(
  messageOrIntent?: string | TalaIntentPayload,
  intent?: TalaIntentPayload,
): void {
  const message = typeof messageOrIntent === "string" ? messageOrIntent : intent?.message;
  const payload = typeof messageOrIntent === "object" ? messageOrIntent : intent ?? null;
  if (listener) {
    listener(message, payload);
    return;
  }
  pending = { message, intent: payload };
}

export function openTalaIntent(kind: TalaIntentKind, context?: TalaIntentContext, message?: string): void {
  openTala({ kind, context: context ?? {}, message });
}