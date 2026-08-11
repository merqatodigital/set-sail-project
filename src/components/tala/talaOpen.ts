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

export function setTalaOpenListener(fn: Listener | null) {
  listener = fn;
}

export function openTala(message?: string, intent?: TalaIntentPayload): void;
export function openTala(intent: TalaIntentPayload): void;
export function openTala(
  messageOrIntent?: string | TalaIntentPayload,
  intent?: TalaIntentPayload,
): void {
  const message = typeof messageOrIntent === "string" ? messageOrIntent : intent?.message;
  const payload = typeof messageOrIntent === "object" ? messageOrIntent : intent ?? null;
  if (listener) listener(message, payload);
}

export function openTalaIntent(kind: TalaIntentKind, context?: TalaIntentContext, message?: string): void {
  openTala({ kind, context: context ?? {}, message });
}