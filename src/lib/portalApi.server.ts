// ---------------------------------------------------------------------------
// Server-side Guest Portal API (supabase service role + signed guest sessions).
//
// SECURITY CONTRACT
//   * This module runs ONLY inside the server entry (src/server.ts) — never
//     imported by client code, never bundles the service role key.
//   * Guests get a short-lived HMAC-signed session bound to their normalized
//     phone number (and display name). The signature key is derived from the
//     server-only SUPABASE_SERVICE_ROLE_KEY binding; the browser never sees it.
//   * A session is ONLY issued after the caller's phone + name positively match
//     an EXISTING trustworthy Marina Terrace guest/stay/request record
//     (verifyGuestIdentity) — never for an unverified phone + name claim.
//     Trustworthy sources are records the caller cannot self-create in a way
//     that grants access: the admin-managed `guests` directory, `bookings` in
//     an owner-set status (phone proven via the linked guests row or notes),
//     and owner-confirmed (status = 'confirmed') tala_*_requests rows. Guest-
//     writable tables (tala_food_orders, tala_guest_messages) are NEVER used
//     for identity proof.
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

export function normalizeName(n: string): string {
  return (n || "").trim().toLowerCase().replace(/\s+/g, " ");
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

// --- Guest identity validation ----------------------------------------------

const OWNER_BOOKING_STATUSES = ["confirmed", "checked_in", "checked_out"];
const OWNER_CONFIRMED_REQUEST_STATUS = "confirmed";

// Structural type for the subset of the Supabase query builder we chain on.
type QueryBuilder = {
  ilike: (column: string, pattern: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
};

async function queryRows(
  admin: NonNullable<ReturnType<typeof makeAdminClient>>,
  table: string,
  columns: string,
  apply: (q: QueryBuilder) => QueryBuilder,
): Promise<Record<string, unknown>[]> {
  try {
    const builder = admin.from(table).select(columns) as unknown as QueryBuilder;
    const { data, error } = await (apply(builder) as unknown as ReturnType<typeof admin.from>);
    if (error) return [];
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function phoneFromNotes(notes: unknown): string {
  const raw = typeof notes === "string" ? notes : "";
  const match = raw.match(
    /(?:phone|contact|mobile|tel(?:ephone)?|whatsapp)\s*[:#-]?\s*(\+?[0-9][0-9\s\-().]{6,19})/i,
  );
  return match ? normalizePhone(match[1]) : "";
}

function rowMatches(
  row: Record<string, unknown>,
  nameColumn: string,
  phoneColumn: string,
  name: string,
  phone: string,
): boolean {
  return (
    normalizeName(String(row[nameColumn] ?? "")) === name &&
    normalizePhone(String(row[phoneColumn] ?? "")) === phone
  );
}

export async function verifyGuestIdentity(
  env: unknown,
  phone: string,
  name: string,
): Promise<boolean> {
  const admin = makeAdminClient(env);
  if (!admin) return false;

  const normalizedName = normalizeName(name);

  // A. Admin-managed guest directory (admin-only table, anon cannot write).
  const guests = await queryRows(admin, "guests", "name, phone", (q) =>
    q.ilike("name", normalizedName),
  );
  if (guests.some((row) => rowMatches(row, "name", "phone", normalizedName, phone))) {
    return true;
  }

  // B. Owner-managed stays. Some schemas carry guest_phone directly on
  //    bookings; if not, prove the phone via the linked guests row or notes.
  const bookingsWithPhone = await queryRows(
    admin,
    "bookings",
    "guest_name, guest_phone, status",
    (q) => q.in("status", OWNER_BOOKING_STATUSES).ilike("guest_name", normalizedName),
  );
  if (
    bookingsWithPhone.some((row) =>
      rowMatches(row, "guest_name", "guest_phone", normalizedName, phone),
    )
  ) {
    return true;
  }

  const bookingsMeta = await queryRows(
    admin,
    "bookings",
    "guest_name, guest_id, notes, status",
    (q) => q.in("status", OWNER_BOOKING_STATUSES).ilike("guest_name", normalizedName),
  );
  for (const row of bookingsMeta) {
    if (normalizeName(String(row.guest_name ?? "")) !== normalizedName) continue;
    const guestId = String(row.guest_id ?? "");
    if (guestId) {
      const linked = await queryRows(admin, "guests", "phone", (q) => q.eq("id", guestId));
      if (linked.some((g) => normalizePhone(String(g.phone ?? "")) === phone)) return true;
    }
    if (phoneFromNotes(row.notes) === phone) return true;
  }

  // C. Owner-confirmed requests. Only status = 'confirmed' counts — the portal
  //    migration restricts anon INSERT to guest-created statuses (pending /
  //    requested), so a caller cannot forge a confirmed row for a phone they
  //    do not own. Guest-created pending/requested rows are never identity.
  for (const table of ["tala_booking_requests", "tala_tour_requests", "tala_rental_requests"]) {
    const rows = await queryRows(admin, table, "guest_name, guest_phone, status", (q) =>
      q.eq("status", OWNER_CONFIRMED_REQUEST_STATUS).ilike("guest_name", normalizedName),
    );
    if (rows.some((row) => rowMatches(row, "guest_name", "guest_phone", normalizedName, phone))) {
      return true;
    }
  }

  return false;
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
