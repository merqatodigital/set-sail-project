// Lightweight global bus so any public CTA can open the TALA chat widget and
// pre-fill a message (e.g. "I want to book a Day Pass"). The widget subscribes
// on mount; CTAs just call openTala(text). Keeps CTAs decoupled from the
// widget instance.

type Listener = (message?: string) => void;

let listener: Listener | null = null;

export function setTalaOpenListener(fn: Listener | null) {
  listener = fn;
}

export function openTala(message?: string) {
  if (listener) listener(message);
}
