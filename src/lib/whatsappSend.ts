import { supabase, isSupabaseConnected } from "./supabase";

// ---------------------------------------------------------------------------
// Client-side wrapper around the `whatsapp-send` Edge Function. Every call
// here requires an authenticated admin session (the function checks
// has_role(auth.uid(), 'admin') itself) — this is what lets the admin
// console and TALA's operator-only send_whatsapp_message tool actually
// deliver a WhatsApp message, instead of just opening a wa.me link for a
// human to send by hand.
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const WHATSAPP_SEND_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/whatsapp-send` : null;

export interface WhatsAppSendResult {
  success: boolean;
  error?: string;
  messageId?: string | null;
}

async function callWhatsAppSend(body: Record<string, unknown>): Promise<WhatsAppSendResult> {
  if (!WHATSAPP_SEND_ENDPOINT || !isSupabaseConnected() || !supabase) {
    return { success: false, error: "Supabase is not connected." };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: "You must be signed in as admin to send WhatsApp messages." };
  }
  try {
    const res = await fetch(WHATSAPP_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result?.error) {
      return { success: false, error: result?.error || `Send failed (${res.status}).` };
    }
    return { success: true, messageId: result?.messageId ?? null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not reach WhatsApp." };
  }
}

/** Free-form text — only deliverable if the recipient messaged this number within the last 24h. */
export function sendWhatsAppText(to: string, text: string): Promise<WhatsAppSendResult> {
  return callWhatsAppSend({ to, kind: "text", text });
}

/** Pre-approved template — works for cold outbound (reminders, alerts, the daily brief). */
export function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  templateLanguage: string,
  templateParams: string[] = [],
): Promise<WhatsAppSendResult> {
  return callWhatsAppSend({ to, kind: "template", templateName, templateLanguage, templateParams });
}
