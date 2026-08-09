// Server-side Marina Terrace operational data (bookings + guests) for TallaAgent.
//
// This is the ONLY place the Cloudflare Worker reads public.bookings /
// public.guests. It runs inside the Worker (never the browser), scopes the
// query to the canonical resort (marina_terrace), and returns structured
// operational data for injection into the TallaAgent tool loop. Supabase
// remains the source of truth for bookings/guests; we never copy them into D1.
//
// NOTE on scoping: the bookings/guests tables are not partitioned by a
// resort_id column (single-resort deployment). Resort scoping here means the
// Worker only serves the canonical resort (marina_terrace) and refuses to read
// operational data for any other tenant. This guard keeps the connection safe
// as the product grows toward multi-resort.

import type { Env } from "../env.js";

// Canonical resort/tenant this Worker instance serves.
const KNOWN_RESORT = "marina_terrace";

export interface BookingRow {
  id: string;
  reference: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  source: string;
}

export interface OperationsSnapshot {
  resortId: string;
  asOf: string;
  inHouseCount: number;
  arrivalsTomorrow: BookingRow[];
  departuresTomorrow: BookingRow[];
  bookingsTomorrow: BookingRow[];
  rawBookingsChecked: number;
  readError?: string;
}

function sanitize(raw: Record<string, unknown>): BookingRow {
  return {
    id: String(raw.id ?? ""),
    reference: String(raw.reference ?? ""),
    guestName: String(raw.guest_name ?? raw.guestName ?? ""),
    roomType: String(raw.room_type ?? raw.roomType ?? ""),
    checkIn: String(raw.check_in ?? raw.checkIn ?? ""),
    checkOut: String(raw.check_out ?? raw.checkOut ?? ""),
    guests: Number(raw.guests ?? raw.guest_count ?? 0) || 0,
    status: String(raw.status ?? ""),
    source: String(raw.source ?? ""),
  };
}

/**
 * Read the resort's bookings/guests from Supabase and compute tomorrow's
 * operational picture. Scoped to the canonical resort only.
 *
 * @param env      Worker bindings (needs SUPABASE_URL + anon/service key)
 * @param tenantId current TallaAgent tenant (must equal the known resort)
 * @param now      reference date (defaults to today, Asia/Manila)
 */
export async function getResortOperations(
  env: Env,
  tenantId: string,
  now: Date = new Date(),
): Promise<OperationsSnapshot> {
  const base = env.SUPABASE_URL
    ? env.SUPABASE_URL.replace(/^["']|["']$/g, "").trim()
    : "";
  const keyRaw = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const key = keyRaw ? keyRaw.replace(/^["']|["']$/g, "").trim() : "";

  const snapshot: OperationsSnapshot = {
    resortId: tenantId,
    asOf: now.toISOString(),
    inHouseCount: 0,
    arrivalsTomorrow: [],
    departuresTomorrow: [],
    bookingsTomorrow: [],
    rawBookingsChecked: 0,
  };

  // Resort scoping: only serve the canonical resort.
  if (tenantId !== KNOWN_RESORT) {
    console.warn(`[operations] refusing operational read for non-canonical tenant: ${tenantId}`);
    return snapshot;
  }
  if (!base || !key) {
    console.warn("[operations] Supabase not configured; skipping operations load.");
    return snapshot;
  }

  // Tomorrow's date in YYYY-MM-DD (Asia/Manila).
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const d = String(tomorrow.getDate()).padStart(2, "0");
  const tomorrowStr = `${y}-${m}-${d}`;

  // Also compute "in-house today": bookings whose check_in <= today and
  // check_out > today, status not cancelled.
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  try {
    const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/bookings`);
    url.searchParams.set("select", "id,reference,guest_name,room_type,check_in,check_out,guests,status,source");
    url.searchParams.set("order", "check_in.asc");
    const res = await fetch(url.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.error(`[operations] Supabase responded ${res.status}`);
      snapshot.readError = `Supabase bookings read failed (HTTP ${res.status})`;
      return snapshot;
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    snapshot.rawBookingsChecked = rows.length;
    const all = rows.map(sanitize);

    // In-house: check_in <= today AND check_out > today, not cancelled.
    snapshot.inHouseCount = all.filter(
      (b) =>
        b.checkIn <= todayStr &&
        b.checkOut > todayStr &&
        b.status !== "cancelled" &&
        b.status !== "cancelled_booking",
    ).length;

    // Tomorrow arrivals/departures/bookings.
    for (const b of all) {
      const isActive = b.status !== "cancelled" && b.status !== "cancelled_booking";
      if (!isActive) continue;
      if (b.checkIn === tomorrowStr) snapshot.arrivalsTomorrow.push(b);
      if (b.checkOut === tomorrowStr) snapshot.departuresTomorrow.push(b);
      if (b.checkIn <= tomorrowStr && b.checkOut > tomorrowStr) snapshot.bookingsTomorrow.push(b);
    }
    return snapshot;
  } catch (err) {
    console.error("[operations] fetch failed:", err);
    snapshot.readError = `Supabase bookings read error: ${(err as Error).message}`;
    return snapshot;
  }
}
