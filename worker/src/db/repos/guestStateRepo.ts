// Guest-state reads/writes for TallaAgent — the SAME persistent Supabase truth
// the Guest Portal uses. Reuses the exact Supabase REST pattern from
// db/operations.ts (server-side service-role key). Single-resort scope preserved
// via KNOWN_RESORT, consistent with operations.ts. Guest matching is by
// guest_name/guest_phone (the operational tables carry those columns).
//
// FINAL OpenCode contract (e771f3f): messages -> tala_guest_messages, food ->
// tala_food_orders. Folio -> tala_folio_lines with explicit related_type/related_id
// (no name-search, no fuzzy guess).

import type { Env } from "../../env.js";

function supabaseBase(env: Env): string {
  const raw = env.SUPABASE_URL ? env.SUPABASE_URL.replace(/^["']|["']$/g, "").trim() : "";
  return raw.replace(/\/$/, "");
}
function supabaseKey(env: Env): string {
  const raw = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return raw ? raw.replace(/^["']|["']$/g, "").trim() : "";
}

async function sbSelect(
  env: Env,
  table: string,
  select: string,
  filters: Record<string, string>,
): Promise<Array<Record<string, unknown>>> {
  const base = supabaseBase(env);
  const key = supabaseKey(env);
  if (!base || !key) throw new Error("Supabase not configured");
  const url = new URL(`${base}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Supabase ${table} read failed (HTTP ${res.status})`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

function guestOrFilter(name?: string, phone?: string): Record<string, string> {
  const parts: string[] = [];
  if (name) parts.push(`guest_name=eq.${name}`);
  if (phone) parts.push(`guest_phone=eq.${phone}`);
  return { or: `(${parts.join(",")})` };
}

// ---------------------------------------------------------------------------
// ROOM / STAY — Supabase `bookings`
// ---------------------------------------------------------------------------
export interface GuestStay {
  id: string;
  reference: string;
  roomType: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  status: string;
  amount: number;
  paidAmount: number;
  notes: string;
}
export async function getGuestStay(
  env: Env,
  opts: { name?: string; phone?: string },
): Promise<GuestStay[]> {
  if (!opts.name && !opts.phone) return [];
  const rows = await sbSelect(
    env,
    "bookings",
    "id,reference,guest_name,room_type,guests,check_in,check_out,status,amount,paid_amount,notes",
    { ...guestOrFilter(opts.name, opts.phone), order: "check_in.asc" },
  ).catch(() => []);
  return rows.map((r) => ({
    id: String(r.id),
    reference: String(r.reference ?? ""),
    roomType: String(r.room_type ?? ""),
    guests: Number(r.guests ?? 1),
    checkIn: String(r.check_in ?? ""),
    checkOut: String(r.check_out ?? ""),
    status: String(r.status ?? "pending"),
    amount: Number(r.amount ?? 0),
    paidAmount: Number(r.paid_amount ?? 0),
    notes: String(r.notes ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// TOURS — Supabase `tala_tour_requests` (transaction). Catalog = D1 tours_catalog.
// ---------------------------------------------------------------------------
export interface GuestTourRequest {
  id: string;
  tourName: string;
  tourDate: string;
  guests: number;
  amount: number;
  notes: string;
  status: string;
  source: string;
  createdAt: string;
}
export async function getGuestTourRequests(
  env: Env,
  opts: { name?: string; phone?: string },
): Promise<GuestTourRequest[]> {
  if (!opts.name && !opts.phone) return [];
  const rows = await sbSelect(
    env,
    "tala_tour_requests",
    "id,guest_name,guest_phone,tour_name,tour_date,guests,amount,notes,status,source,created_at",
    { ...guestOrFilter(opts.name, opts.phone), order: "tour_date.asc" },
  ).catch(() => []);
  return rows.map((r) => ({
    id: String(r.id),
    tourName: String(r.tour_name ?? ""),
    tourDate: String(r.tour_date ?? ""),
    guests: Number(r.guests ?? 1),
    amount: Number(r.amount ?? 0),
    notes: String(r.notes ?? ""),
    status: String(r.status ?? "requested"),
    source: String(r.source ?? "tala_chat"),
    createdAt: String(r.created_at ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// MOTORBIKES — request (tala_rental_requests) + active (motorbike_rentals) + rate (motorbikes)
// ---------------------------------------------------------------------------
export interface GuestMotorbikeState {
  id: string;
  source: "request" | "rental";
  bikeName: string;
  bikeLabel: string;
  ratePerDay: number;
  startDate: string;
  endDate: string;
  status: string;
  guestPhone: string;
}
export async function getGuestMotorbikeState(
  env: Env,
  opts: { name?: string; phone?: string },
): Promise<GuestMotorbikeState[]> {
  if (!opts.name && !opts.phone) return [];
  const out: GuestMotorbikeState[] = [];

  const reqs = await sbSelect(
    env,
    "tala_rental_requests",
    "id,guest_name,guest_phone,bike_name,start_date,end_date,status,source",
    { ...guestOrFilter(opts.name, opts.phone), order: "start_date.asc" },
  ).catch(() => []);
  for (const r of reqs) {
    out.push({
      id: String(r.id),
      source: "request",
      bikeName: String(r.bike_name ?? ""),
      bikeLabel: String(r.bike_name ?? ""),
      ratePerDay: 0,
      startDate: String(r.start_date ?? ""),
      endDate: String(r.end_date ?? ""),
      status: String(r.status ?? "requested"),
      guestPhone: String(r.guest_phone ?? ""),
    });
  }

  const rentals = await sbSelect(
    env,
    "motorbike_rentals",
    "id,bike_id,guest_name,guest_phone,start_date,end_date,status",
    { ...guestOrFilter(opts.name, opts.phone), order: "start_date.asc" },
  ).catch(() => []);
  for (const r of rentals) {
    const bikeId = String(r.bike_id ?? "");
    const bike = await sbSelect(
      env,
      "motorbikes",
      "name,daily_rate",
      { id: `eq.${bikeId}` },
    ).catch(() => [] as Array<Record<string, unknown>>);
    const b = bike[0] ?? {};
    out.push({
      id: String(r.id),
      source: "rental",
      bikeName: String(b.name ?? bikeId),
      bikeLabel: String(b.name ?? bikeId),
      ratePerDay: Number(b.daily_rate ?? 0),
      startDate: String(r.start_date ?? ""),
      endDate: String(r.end_date ?? ""),
      status: String(r.status ?? "active"),
      guestPhone: String(r.guest_phone ?? ""),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// FOOD — Supabase `tala_food_orders` (authoritative guest transaction source)
// ---------------------------------------------------------------------------
export interface GuestFoodOrder {
  id: string;
  reference: string;
  items: unknown[];
  total: number;
  status: string;
  notes: string;
  confirmedAt: string;
  preparingAt: string;
  readyAt: string;
  deliveredAt: string;
  cancelledAt: string;
  paidAmount: number;
  paidAt: string;
}
export async function getGuestFoodOrders(
  env: Env,
  opts: { name?: string; phone?: string },
): Promise<GuestFoodOrder[]> {
  if (!opts.name && !opts.phone) return [];
  const rows = await sbSelect(
    env,
    "tala_food_orders",
    "id,reference,guest_name,guest_phone,items,total,status,notes,confirmed_at,preparing_at,ready_at,delivered_at,cancelled_at,paid_amount,paid_at",
    { ...guestOrFilter(opts.name, opts.phone), order: "created_at.asc" },
  ).catch(() => []);
  return rows.map((r) => ({
    id: String(r.id),
    reference: String(r.reference ?? ""),
    items: Array.isArray(r.items) ? (r.items as unknown[]) : [],
    total: Number(r.total ?? 0),
    status: String(r.status ?? "pending"),
    notes: String(r.notes ?? ""),
    confirmedAt: String(r.confirmed_at ?? ""),
    preparingAt: String(r.preparing_at ?? ""),
    readyAt: String(r.ready_at ?? ""),
    deliveredAt: String(r.delivered_at ?? ""),
    cancelledAt: String(r.cancelled_at ?? ""),
    paidAmount: Number(r.paid_amount ?? 0),
    paidAt: String(r.paid_at ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// MESSAGES — Supabase `tala_guest_messages` (Portal inbox source)
// ---------------------------------------------------------------------------
export interface GuestMessage {
  id: string;
  message: string;
  reply: string;
  status: string;
  source: string;
  createdAt: string;
  repliedAt: string;
}
export async function getGuestMessages(
  env: Env,
  opts: { name?: string; phone?: string },
): Promise<GuestMessage[]> {
  if (!opts.name && !opts.phone) return [];
  const rows = await sbSelect(
    env,
    "tala_guest_messages",
    "id,guest_name,guest_phone,message,reply,status,source,created_at,replied_at",
    { ...guestOrFilter(opts.name, opts.phone), order: "created_at.desc" },
  ).catch(() => []);
  return rows.map((r) => ({
    id: String(r.id),
    message: String(r.message ?? ""),
    reply: String(r.reply ?? ""),
    status: String(r.status ?? "unread"),
    source: String(r.source ?? "portal"),
    createdAt: String(r.created_at ?? ""),
    repliedAt: String(r.replied_at ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// FOLIO — Supabase `tala_folio_lines` with EXPLICIT related_type/related_id
// (no name-search, no fuzzy guess; unresolved rows reported separately)
// ---------------------------------------------------------------------------
export interface FolioLine {
  kind: "charge" | "payment";
  category: string;
  description: string;
  amount: number;
  method: string;
  reference: string;
  relatedType: string;
  relatedId: string;
}
export interface GuestFolio {
  guestName: string;
  lines: FolioLine[];
  totalCharges: number;
  totalPaid: number;
  balance: number;
  unresolved: Array<{ id: string; note: string }>;
}
export async function getGuestFolio(
  env: Env,
  opts: { name?: string; phone?: string },
): Promise<GuestFolio> {
  if (!opts.name && !opts.phone) {
    return { guestName: "", lines: [], totalCharges: 0, totalPaid: 0, balance: 0, unresolved: [] };
  }
  // Folio lines are linked by guest_name/guest_phone explicitly (no text search).
  const rows = await sbSelect(
    env,
    "tala_folio_lines",
    "id,kind,category,description,amount,method,reference,related_type,related_id,guest_name,guest_phone",
    { ...guestOrFilter(opts.name, opts.phone), order: "created_at.asc" },
  ).catch(() => []);
  const lines: FolioLine[] = [];
  const unresolved: Array<{ id: string; note: string }> = [];
  for (const r of rows) {
    const kind = String(r.kind ?? "charge");
    const relatedType = String(r.related_type ?? "");
    const relatedId = String(r.related_id ?? "");
    if ((kind === "charge" || kind === "payment") && !relatedType && !relatedId) {
      // No explicit link — report as unresolved instead of guessing.
      unresolved.push({ id: String(r.id), note: "folio line without related_type/related_id" });
    }
    lines.push({
      kind: kind === "payment" ? "payment" : "charge",
      category: String(r.category ?? "other"),
      description: String(r.description ?? ""),
      amount: Number(r.amount ?? 0),
      method: String(r.method ?? "cash"),
      reference: String(r.reference ?? ""),
      relatedType,
      relatedId,
    });
  }
  const totalCharges = lines
    .filter((l) => l.kind === "charge")
    .reduce((s, l) => s + l.amount, 0);
  const totalPaid = lines
    .filter((l) => l.kind === "payment")
    .reduce((s, l) => s + Math.abs(l.amount), 0);
  return {
    guestName: opts.name ?? "",
    lines,
    totalCharges,
    totalPaid,
    balance: totalCharges - totalPaid,
    unresolved,
  };
}

// ---------------------------------------------------------------------------
// WRITE — persist a TALA operational message into `tala_guest_messages`
// ---------------------------------------------------------------------------
export interface WriteGuestMessageInput {
  guestName: string;
  guestPhone: string;
  message: string;
  reply?: string;
  status?: string;
  source?: string;
}
export async function writeGuestMessage(
  env: Env,
  input: WriteGuestMessageInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const base = supabaseBase(env);
  const key = supabaseKey(env);
  if (!base || !key) return { ok: false, error: "Supabase not configured" };
  const id = `tala_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${base}/rest/v1/tala_guest_messages`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id,
      guest_name: input.guestName,
      guest_phone: input.guestPhone,
      message: input.message,
      reply: input.reply ?? "",
      status: input.status ?? "unread",
      source: input.source ?? "tala_chat",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Message persist failed (HTTP ${res.status}): ${body.slice(0, 200)}` };
  }
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// BOOKING REQUEST — deterministic room-booking creation into tala_booking_requests
// with explicit contact persistence + short human reference + duplicate guard.
// ---------------------------------------------------------------------------
export interface CreateBookingRequestInput {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  notes?: string;
}
export interface BookingRequestResult {
  id: string;
  reference: string;
}

function makeReference(checkIn: string): string {
  // MT-YYYYMMDD-XXXX — short, human-readable; UUID stays the PK internally.
  const ymd = (checkIn || "").replace(/-/g, "").slice(0, 8) || "00000000";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MT-${ymd}-${rand}`;
}

/** Find an existing PENDING booking for the same guest/room/dates/guests (dedupe). */
export async function findPendingBooking(
  env: Env,
  opts: { guestName: string; roomType: string; checkIn: string; checkOut: string; guests: number },
): Promise<BookingRequestResult | null> {
  const rows = await sbSelect(
    env,
    "tala_booking_requests",
    "id,reference,guest_name,room_type,check_in,check_out,guests,status",
    {
      and: `(guest_name.eq.${opts.guestName},room_type.eq.${opts.roomType},check_in.eq.${opts.checkIn},check_out.eq.${opts.checkOut},guests.eq.${opts.guests},status.eq.pending)`,
    },
  ).catch(() => []);
  const r = rows[0];
  return r ? { id: String(r.id), reference: String(r.reference ?? "") } : null;
}

export async function createBookingRequest(
  env: Env,
  input: CreateBookingRequestInput,
): Promise<BookingRequestResult> {
  const base = supabaseBase(env);
  const key = supabaseKey(env);
  if (!base || !key) throw new Error("Supabase not configured");
  // Do NOT generate an id — let Supabase DEFAULT gen_random_uuid() create the UUID PK.
  const reference = makeReference(input.checkIn);
  const res = await fetch(`${base}/rest/v1/tala_booking_requests`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      reference,
      guest_name: input.guestName,
      guest_email: input.guestEmail,
      guest_phone: input.guestPhone,
      room_type: input.roomType,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guests: input.guests,
      notes: input.notes ?? "",
      status: "pending",
      source: "tala_chat",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Booking request failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  // Read the server-generated UUID from the representation (never exposed to guest).
  const rows = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
  const id = rows[0] ? String(rows[0].id) : "";
  return { id, reference };
}

// ---------------------------------------------------------------------------
// ROOM AVAILABILITY — read-only conflict check against authoritative `bookings`.
// Returns real overlap data only; performs NO write and never invents capacity.
// ---------------------------------------------------------------------------
export type AvailabilityStatus = "available" | "unavailable" | "unknown";
export interface RoomAvailability {
  status: AvailabilityStatus;
  roomType: string;
  checkIn: string;
  checkOut: string;
  conflictingBookings: number;
  message: string;
}

export async function checkRoomAvailability(
  env: Env,
  opts: { roomType: string; checkIn: string; checkOut: string; guests?: number },
): Promise<RoomAvailability> {
  const base = supabaseBase(env);
  const key = supabaseKey(env);
  const fallback = (msg: string): RoomAvailability => ({
    status: "unknown",
    roomType: opts.roomType,
    checkIn: opts.checkIn,
    checkOut: opts.checkOut,
    conflictingBookings: 0,
    message: msg,
  });
  if (!base || !key) return fallback("Availability service not configured.");
  try {
    const rows = await sbSelect(
      env,
      "bookings",
      "id,room_type,check_in,check_out,status,guests",
      {
        room_type: `eq.${opts.roomType}`,
        status: "in.(confirmed,checked_in)",
        and: `(check_in.lt.${opts.checkOut},check_out.gt.${opts.checkIn})`,
      },
    );
    const conflicts = rows.filter((r) => String(r.room_type) === opts.roomType).length;
    if (conflicts > 0) {
      return {
        status: "unavailable",
        roomType: opts.roomType,
        checkIn: opts.checkIn,
        checkOut: opts.checkOut,
        conflictingBookings: conflicts,
        message: `${opts.roomType} is not available for ${opts.checkIn} to ${opts.checkOut} (${conflicts} conflicting reservation(s)).`,
      };
    }
    return {
      status: "available",
      roomType: opts.roomType,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      conflictingBookings: 0,
      message: `No reservation conflicts for ${opts.roomType} ${opts.checkIn} to ${opts.checkOut}. We'll confirm capacity when you request the booking.`,
    };
  } catch {
    return fallback("Could not verify availability right now.");
  }
}
