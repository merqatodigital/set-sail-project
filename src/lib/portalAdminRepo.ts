// ---------------------------------------------------------------------------
// Admin-side repository for the guest operational tables — the SAME records
// the Guest Portal creates and TALA reads.
//
//   TOURS     -> public.tala_tour_requests
//   RENTALS   -> public.tala_rental_requests
//   BOOKINGS  -> public.tala_booking_requests
//   FOOD      -> public.tala_food_orders
//   MESSAGES  -> public.tala_guest_messages
//   FOLIO     -> public.tala_folio_lines
//
// Runs as the signed-in admin's `authenticated` role. RLS on these tables
// (see supabase/migrations/20260810_guest_portal_persistence.sql) grants
// authenticated SELECT/UPDATE on tala_*_requests and full manage on
// tala_food_orders / tala_guest_messages / tala_folio_lines. No localStorage
// or cms_data authority — the DB row is the source of truth for admin and
// staff actions, and TALA/Hermes reads the exact same rows.
// ---------------------------------------------------------------------------

import { supabase, isSupabaseConnected } from "@/lib/supabase";
import type {
  PortalBookingRequestRow,
  PortalTourRequestRow,
  PortalRentalRequestRow,
  PortalFoodOrderRow,
  PortalGuestMessageRow,
  PortalFolioLineRow,
} from "@/lib/portalRepo";

function db() {
  return supabase as any;
}

function connected(): boolean {
  return isSupabaseConnected() && !!supabase;
}

// --- Tours (tala_tour_requests) ---------------------------------------------

export async function listPortalTourRequests(): Promise<PortalTourRequestRow[]> {
  if (!connected()) return [];
  const { data } = await db()
    .from("tala_tour_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PortalTourRequestRow[];
}

export async function updatePortalTourStatus(id: string, status: string): Promise<boolean> {
  if (!connected()) return false;
  const patch: Record<string, unknown> = { status };
  if (status === "confirmed") patch.confirmed_at = new Date().toISOString();
  const { error } = await db().from("tala_tour_requests").update(patch).eq("id", id);
  return !error;
}

// --- Rentals (tala_rental_requests) -----------------------------------------

export async function listPortalRentalRequests(): Promise<PortalRentalRequestRow[]> {
  if (!connected()) return [];
  const { data } = await db()
    .from("tala_rental_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PortalRentalRequestRow[];
}

export async function updatePortalRentalStatus(id: string, status: string): Promise<boolean> {
  if (!connected()) return false;
  const patch: Record<string, unknown> = { status };
  // "active" implies the owner confirmed the request and it became an actual
  // operational rental, so stamp confirmed_at too.
  if (status === "confirmed" || status === "active") patch.confirmed_at = new Date().toISOString();
  const { error } = await db().from("tala_rental_requests").update(patch).eq("id", id);
  return !error;
}

// --- Booking requests (tala_booking_requests) --------------------------------

export async function listPortalBookingRequests(): Promise<PortalBookingRequestRow[]> {
  if (!connected()) return [];
  const { data } = await db()
    .from("tala_booking_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PortalBookingRequestRow[];
}

export async function updatePortalBookingStatus(id: string, status: string): Promise<boolean> {
  if (!connected()) return false;
  const patch: Record<string, unknown> = { status };
  if (status === "confirmed") patch.confirmed_at = new Date().toISOString();
  const { error } = await db().from("tala_booking_requests").update(patch).eq("id", id);
  return !error;
}

// --- Food orders (tala_food_orders) ------------------------------------------

export async function listPortalFoodOrders(): Promise<PortalFoodOrderRow[]> {
  if (!connected()) return [];
  const { data } = await db()
    .from("tala_food_orders")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PortalFoodOrderRow[];
}

/**
 * Progress a food order. The *_at timestamp matching the new status is written
 * so TALA can answer "Your food is being prepared." from the same row.
 */
export async function updatePortalFoodStatus(id: string, status: string): Promise<boolean> {
  if (!connected()) return false;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "confirmed") patch.confirmed_at = now;
  if (status === "preparing") patch.preparing_at = now;
  if (status === "ready") patch.ready_at = now;
  if (status === "delivered") patch.delivered_at = now;
  if (status === "cancelled") patch.cancelled_at = now;
  const { error } = await db().from("tala_food_orders").update(patch).eq("id", id);
  return !error;
}

export async function deletePortalFoodOrder(id: string): Promise<boolean> {
  if (!connected()) return false;
  const { error } = await db().from("tala_food_orders").delete().eq("id", id);
  return !error;
}

// --- Guest messages (tala_guest_messages) ------------------------------------

export async function listPortalGuestMessages(): Promise<PortalGuestMessageRow[]> {
  if (!connected()) return [];
  const { data } = await db()
    .from("tala_guest_messages")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PortalGuestMessageRow[];
}

export async function markPortalMessageRead(id: string): Promise<boolean> {
  if (!connected()) return false;
  const { error } = await db()
    .from("tala_guest_messages")
    .update({ status: "read" })
    .eq("id", id);
  return !error;
}

export async function replyPortalMessage(id: string, reply: string): Promise<boolean> {
  if (!connected()) return false;
  const { error } = await db()
    .from("tala_guest_messages")
    .update({ reply: reply.slice(0, 2000), status: "replied", replied_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deletePortalGuestMessage(id: string): Promise<boolean> {
  if (!connected()) return false;
  const { error } = await db().from("tala_guest_messages").delete().eq("id", id);
  return !error;
}

// --- Folio lines (tala_folio_lines) ------------------------------------------

export async function listPortalFolioLines(): Promise<PortalFolioLineRow[]> {
  if (!connected()) return [];
  const { data } = await db()
    .from("tala_folio_lines")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as PortalFolioLineRow[];
}

export interface NewFolioLine {
  guest_name: string;
  guest_phone: string;
  kind: "charge" | "payment";
  category: string;
  description: string;
  amount: number;
  method: string;
  reference: string;
  related_type: string;
  related_id: string;
}

export async function addPortalFolioLine(line: NewFolioLine): Promise<boolean> {
  if (!connected()) return false;
  const { error } = await db().from("tala_folio_lines").insert({
    guest_name: line.guest_name.slice(0, 200),
    guest_phone: line.guest_phone.slice(0, 200),
    kind: line.kind,
    category: line.category.slice(0, 50),
    description: line.description.slice(0, 500),
    amount: line.amount,
    method: line.method.slice(0, 50),
    reference: line.reference.slice(0, 100),
    related_type: line.related_type.slice(0, 50),
    related_id: line.related_id.slice(0, 200),
  });
  return !error;
}
