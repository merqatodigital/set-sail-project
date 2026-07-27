// WhatsApp sender — Supabase Edge Function proxying the Meta WhatsApp
// Business Cloud API. This is the ONLY place the access token and phone
// number ID ever live — both stay server-side as Supabase secrets, same
// pattern as OPENROUTER_API_KEY for tala-chat. Nothing in the browser or in
// cms_data (which is public-readable) ever sees the real token.
//
// One-time setup (do this in the Meta for Developers dashboard first, then
// here):
//   supabase secrets set WHATSAPP_ACCESS_TOKEN=EAAG...
//   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=123456789012345
// Deploy with:
//   supabase functions deploy whatsapp-send
// (no --no-verify-jwt here on purpose — every caller must be an
// authenticated admin; the daily-briefing pg_cron job calls this using the
// service role key instead, which also passes the check below.)
//
// Meta enforces two very different sending modes:
//   - "text": a free-form message. Only deliverable if the recipient
//     messaged this WhatsApp number within the last 24 hours (the
//     "customer service window"). Meta rejects it otherwise (error 131047).
//   - "template": a pre-approved message template (created + approved in
//     Meta Business Manager beforehand). Works any time, including cold
//     outbound (booking reminders, the daily brief, low-stock alerts) —
//     this is what most of TALA's proactive messages will use. The
//     template NAME + language must match exactly what you approved in
//     Meta; the {{1}}, {{2}}... placeholders come from `templateParams`.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SendBody {
  to: string; // E.164-ish, e.g. "639171234567" or "+63 917 123 4567" (digits extracted)
  kind: "text" | "template";
  text?: string;
  templateName?: string;
  templateLanguage?: string; // e.g. "en_US"
  templateParams?: string[]; // fills {{1}}, {{2}}... in the template body, in order
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return digits;
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // ---- Authorization: admin session or the service role key (pg_cron). ----
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!token) return json({ error: "Missing Authorization header." }, 401);

  const isServiceRole = serviceRoleKey && token === serviceRoleKey;
  if (!isServiceRole) {
    // Otherwise this must be a real admin user's JWT — verify has_role admin.
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not authenticated." }, 401);
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin access required to send WhatsApp messages." }, 403);
  }

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) {
    return json(
      {
        error:
          "WhatsApp isn't configured yet — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Supabase Edge Function secrets first.",
      },
      500,
    );
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const to = normalizePhone(String(body.to || ""));
  if (!to) return json({ error: "A valid recipient phone number is required." }, 400);

  let payload: Record<string, unknown>;
  if (body.kind === "template") {
    const name = String(body.templateName || "").trim();
    if (!name) return json({ error: "templateName is required for a template message." }, 400);
    const language = String(body.templateLanguage || "en_US").trim();
    const params = Array.isArray(body.templateParams) ? body.templateParams : [];
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(params.length
          ? { components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) }] }
          : {}),
      },
    };
  } else {
    const text = String(body.text || "").trim();
    if (!text) return json({ error: "text is required for a text message." }, 400);
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text.slice(0, 4096) },
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const metaError = result?.error;
      // 131047 = re-engagement message outside the 24h window — the most
      // common failure for "text" sends; surface it plainly so the caller
      // knows to use a template instead.
      const hint =
        metaError?.code === 131047
          ? " (Outside the 24h customer-service window — use a template message instead for cold outbound.)"
          : "";
      return json(
        { error: `WhatsApp API error: ${metaError?.message || res.statusText}${hint}`, metaError },
        502,
      );
    }
    return json({ success: true, messageId: result?.messages?.[0]?.id ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed to reach WhatsApp API." }, 502);
  }
}

Deno.serve(handleRequest);
