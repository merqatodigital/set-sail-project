// WhatsApp sender — Supabase Edge Function proxying Twilio's WhatsApp API.
// This is the ONLY place the Twilio credentials ever live — both stay
// server-side as Supabase secrets, same pattern as OPENROUTER_API_KEY for
// tala-chat. Nothing in the browser or in cms_data (which is public-readable)
// ever sees the real token.
//
// One-time setup (get these from Twilio Console → Account → API keys):
//   supabase secrets set TWILIO_ACCOUNT_SID=AC...
//   supabase secrets set TWILIO_AUTH_TOKEN=...
// Deploy with:
//   supabase functions deploy whatsapp-send
// (no --no-verify-jwt here on purpose — every caller must be an
// authenticated admin; the daily-briefing pg_cron job calls this using the
// service role key instead, which also passes the check below.)
//
// Twilio supports two sending modes:
//   - "text": a free-form message. Only deliverable if the recipient
//     messaged this WhatsApp number within the last 24 hours (the
//     "service window"). Twilio rejects it otherwise.
//   - "template": a pre-approved message template (created + approved in
//     Twilio console beforehand). Works any time, including cold outbound
//     (booking reminders, the daily brief, low-stock alerts). The
//     templateName is the Twilio Content SID; templateParams fills variables.

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
  to: string; // E.164-ish, e.g. "639171234567" or "+63 917 123 4567"
  kind: "text" | "template";
  text?: string;
  templateName?: string; // Twilio Content SID, e.g. "HXfda3c3d7e4dab5c1d9e2f3a4b5c6d7e8"
  templateParams?: string[]; // template variables {{1}}, {{2}}...
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  // Return with + prefix for Twilio
  return "+" + (digits.startsWith("1") ? digits : "63" + digits); // Default to PH country code if missing
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

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) {
    return json(
      {
        error:
          "WhatsApp isn't configured yet — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN as Supabase Edge Function secrets first.",
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
  if (!to || to.length < 8) return json({ error: "A valid recipient phone number is required." }, 400);

  const from = "whatsapp:+14155238886"; // Twilio Sandbox WhatsApp number (will change to real number in production)

  const formData = new URLSearchParams();
  formData.append("To", `whatsapp:${to}`);
  formData.append("From", from);

  if (body.kind === "template") {
    const contentSid = String(body.templateName || "").trim();
    if (!contentSid) return json({ error: "templateName (Content SID) is required for a template message." }, 400);
    formData.append("ContentSid", contentSid);
    if (Array.isArray(body.templateParams) && body.templateParams.length > 0) {
      // Twilio templates use ContentVariables as JSON with numeric keys
      const vars: Record<string, string> = {};
      body.templateParams.forEach((param, idx) => {
        vars[(idx + 1).toString()] = String(param);
      });
      formData.append("ContentVariables", JSON.stringify(vars));
    }
  } else {
    const text = String(body.text || "").trim();
    if (!text) return json({ error: "text is required for a text message." }, 400);
    formData.append("Body", text.slice(0, 4096));
  }

  try {
    const auth = btoa(`${accountSid}:${authToken}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
        },
        body: formData,
      }
    );
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = result?.message || result?.error || res.statusText;
      return json({ error: `Twilio API error: ${error}` }, 502);
    }
    return json({ success: true, messageId: result?.sid ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed to reach Twilio API." }, 502);
  }
}

Deno.serve(handleRequest);
