// ---------------------------------------------------------------------------
// Server-side Guest Portal API (supabase service role + signed guest sessions).
//
// SECURITY CONTRACT
//   * This module runs ONLY inside the server entry (src/server.ts) — never
//     imported by client code, never bundles the service role key.
//   * Guests get a short-lived HMAC-signed session bound to their normalized
//     phone number (and display name). The signature key is derived from the
//     server-only SUPABASE_SERVICE_ROLE_KEY binding; the browser never sees it.
//   * Private guest reads (booking/tour/rental requests, food orders, guest
//     messages, folio lines) are filtered STRICTLY by the phone number inside
//     the verified session token. Guest A can never read guest B's rows, and
//     an anonymous caller (no valid token) gets 401.
//   * Submissions (anon INSERT) continue to use the anon role RLS policies —
//     INSERT-only, no anon SELECT. See supabase/migrations/
//     20260810_guest_portal_persistence.sql.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const TOKEN_DOMAIN = "mt-portal-session";

export interface PortalGuestSession {
  phone: string; // normalized, digits only, leading 63
  name: string;
  iat: number;
  exp: number;
}

export type ScopedGuestRecords = {
  bookings: Record<string, unknown>[];
  tours: Record<string, unknown>[];
  rentals: Record<string, unknown>[];
  foodOrders: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  folioLines: Record<string, unknown>[];
};

// --- Env helpers -------------------------------------------------------------

function envValue(env: unknown, name: string): string {
  const runtime = env && typeof env === "object" ? (env as Record<string, unknown>)[name] : undefined;
  if (typeof runtime === "string" && runtime) return runtime;
  return typeof process !== "undefined" ? process.env[name] ?? "" : "";
}

export function normalizePhone(p: string): string {
  return (p || "").replace(/[\s\-+()]/g, "").replace(/^0/, "63");
}

// --- Service role Supabase client (server-only) ------------------------------

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function makeAdminClient(env: unknown): ReturnType<typeof createClient> | null {
  const url = envValue(env, "SUPABASE_URL");
  const key = envValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// --- HMAC session tokens (WebCrypto: works in Node + Cloudflare Workers) -----

async function hmacKey(env: unknown): Promise<CryptoKey | null> {
  const secret = envValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`mt-portal-hmac:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function signBody(key: CryptoKey, body: string): Promise<string> {
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${TOKEN_DOMAIN}.${body}`)),
  );
  return toBase64Url(sig);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function issueGuestSession(
  env: unknown,
  phone: string,
  name: string,
): Promise<string | null> {
  const key = await hmacKey(env);
  if (!key) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: PortalGuestSession = { phone, name, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await signBody(key, body)}`;
}

export async function verifyGuestSession(env: unknown, token: string): Promise<PortalGuestSession | null> {
  const key = await hmacKey(env);
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;

  let given: Uint8Array;
  let payloadRaw: Uint8Array;
  try {
    given = fromBase64Url(sigB64);
    payloadRaw = fromBase64Url(body);
  } catch {
    return null;
  }

  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${TOKEN_DOMAIN}.${body}`)));
  if (!constantTimeEqual(expected, given)) return null;

  let payload: PortalGuestSession;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadRaw)) as PortalGuestSession;
  } catch {
    return null;
  }
  if (!payload || typeof payload.phone !== "string" || payload.phone.length < 10) return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { phone: payload.phone, name: typeof payload.name === "string" ? payload.name : "", iat: payload.iat, exp: payload.exp };
}

// --- Scoped private reads ----------------------------------------------------

async function queryScoped(
  admin: NonNullable<ReturnType<typeof makeAdminClient>>,
  table: string,
  phone: string,
  order: { column: string; ascending: boolean },
): Promise<Record<string, unknown>[]> {
  try {
    const { data } = await admin
      .from(table)
      .select("*")
      .eq("guest_phone", phone)
      .order(order.column, { ascending: order.ascending });
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

export async function fetchScopedGuestRecords(env: unknown, phone: string): Promise<ScopedGuestRecords> {
  const admin = makeAdminClient(env);
  const empty: ScopedGuestRecords = {
    bookings: [],
    tours: [],
    rentals: [],
    foodOrders: [],
    messages: [],
    folioLines: [],
  };
  if (!admin) return empty;

  const [bookings, tours, rentals, foodOrders, messages, folioLines] = await Promise.all([
    queryScoped(admin, "tala_booking_requests", phone, { column: "created_at", ascending: false }),
    queryScoped(admin, "tala_tour_requests", phone, { column: "created_at", ascending: false }),
    queryScoped(admin, "tala_rental_requests", phone, { column: "created_at", ascending: false }),
    queryScoped(admin, "tala_food_orders", phone, { column: "created_at", ascending: false }),
    queryScoped(admin, "tala_guest_messages", phone, { column: "created_at", ascending: false }),
    queryScoped(admin, "tala_folio_lines", phone, { column: "created_at", ascending: true }),
  ]);

  return { bookings, tours, rentals, foodOrders, messages, folioLines };
}
