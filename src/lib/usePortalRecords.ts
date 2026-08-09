// ---------------------------------------------------------------------------
// usePortalRecords — one source of records for the Guest Portal.
//
// Primary source: Supabase tala_*_requests / tala_food_orders /
// tala_guest_messages / tala_folio_lines (authoritative, server-side).
// Fallback: cms_data blob operations.* — UI cache / demo compatibility ONLY,
// merged in so existing demo data still shows when Supabase is unavailable.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { useCms } from "@/context/CmsContext";
import type {
  Booking,
  TourBooking,
  MotorbikeRental,
  FoodOrder,
  Payment,
  GuestMessage,
  CmsData,
} from "@/types/cms";
import {
  fetchGuestRecords,
  normalizePhone,
  type PortalGuestIdentity,
  type PortalGuestRecords,
} from "@/lib/portalRepo";

export interface PortalRecordsUI {
  bookings: Booking[];
  tourBookings: TourBooking[];
  rentals: MotorbikeRental[];
  foodOrders: FoodOrder[];
  messages: GuestMessage[];
  payments: Payment[];
  loading: boolean;
}

function emptyUI(): PortalRecordsUI {
  return { bookings: [], tourBookings: [], rentals: [], foodOrders: [], messages: [], payments: [], loading: true };
}

function mapRecords(r: PortalGuestRecords): Omit<PortalRecordsUI, "loading"> {
  return {
    bookings: r.bookings.map(
      (b): Booking => ({
        id: b.id,
        reference: b.reference,
        guestId: "",
        guestName: b.guest_name,
        guestPhone: b.guest_phone,
        roomType: b.room_type,
        checkIn: b.check_in,
        checkOut: b.check_out,
        guests: b.guests,
        amount: b.amount,
        paidAmount: b.paid_amount,
        status: (b.status as Booking["status"]) || "pending",
        source: "direct",
        notes: b.notes,
        createdAt: b.created_at,
      }),
    ),
    tourBookings: r.tours.map(
      (t): TourBooking => ({
        id: t.id,
        reference: t.reference,
        tourId: "",
        tourName: t.tour_name,
        guestName: t.guest_name,
        guestPhone: t.guest_phone,
        date: t.tour_date,
        guests: t.guests,
        amount: t.amount,
        cost: 0,
        paidAmount: t.paid_amount,
        status: (t.status as TourBooking["status"]) || "confirmed",
        notes: t.notes,
        createdAt: t.created_at,
      }),
    ),
    rentals: r.rentals.map(
      (x): MotorbikeRental => ({
        id: x.id,
        reference: x.reference,
        bikeId: "",
        bikeName: x.bike_name,
        guestName: x.guest_name,
        guestPhone: x.guest_phone,
        startDate: x.start_date,
        endDate: x.end_date,
        days: x.days,
        amount: x.amount,
        paidAmount: x.paid_amount,
        deposit: 0,
        status: (x.status as MotorbikeRental["status"]) || "active",
        notes: x.notes,
        createdAt: x.created_at,
      }),
    ),
    foodOrders: r.foodOrders.map(
      (f): FoodOrder => ({
        id: f.id,
        reference: f.reference,
        guestName: f.guest_name,
        guestPhone: f.guest_phone,
        items: f.items,
        total: f.total,
        totalCost: f.total_cost,
        status: (f.status as FoodOrder["status"]) || "pending",
        notes: f.notes,
        createdAt: f.created_at,
        confirmedAt: f.confirmed_at || "",
        preparingAt: f.preparing_at || "",
        readyAt: f.ready_at || "",
        deliveredAt: f.delivered_at || "",
        cancelledAt: f.cancelled_at || "",
      }),
    ),
    messages: r.messages.map(
      (m): GuestMessage => ({
        id: m.id,
        guestName: m.guest_name,
        guestPhone: m.guest_phone,
        message: m.message,
        reply: m.reply,
        status: (m.status as GuestMessage["status"]) || "unread",
        createdAt: m.created_at,
        repliedAt: m.replied_at || "",
      }),
    ),
    payments: r.folioLines
      .filter((l) => l.kind === "payment")
      .map(
        (l): Payment => ({
          id: l.id,
          reference: l.reference,
          date: l.created_at.slice(0, 10),
          category: "other",
          direction: "in",
          amount: l.amount,
          method: (l.method as Payment["method"]) || "cash",
          relatedId: l.related_id,
          description: l.description,
          notes: "",
        }),
      ),
  };
}

function matchesBlob(
  guestName: string,
  guestPhone: string | undefined,
  guest: PortalGuestIdentity,
): boolean {
  const phone = normalizePhone(guest.phone);
  const phoneMatch = guestPhone && normalizePhone(guestPhone) === phone;
  const nameMatch = guestName.toLowerCase() === guest.name.toLowerCase();
  return phoneMatch || nameMatch;
}

/** Build UI records from the cms_data blob (demo fallback only). */
function recordsFromBlob(
  cms: CmsData | null,
  guest: PortalGuestIdentity,
): Omit<PortalRecordsUI, "loading"> {
  const ops = cms?.operations;
  const base = emptyUI();
  if (!ops) return base;

  const bookingPhone = (b: { guestName: string; notes?: string }) =>
    b.notes?.match(/Phone:\s*(.+)/i)?.[1]?.replace(/\s/g, "") || "";

  const bookings: Booking[] = (ops.bookings ?? []).filter((b: any) => {
    const fromNotes = bookingPhone(b);
    const nameMatch = b.guestName?.toLowerCase() === guest.name.toLowerCase();
    return nameMatch || (!!fromNotes && normalizePhone(fromNotes) === normalizePhone(guest.phone));
  });

  const tourBookings: TourBooking[] = (ops.tourBookings ?? []).filter((b: any) =>
    matchesBlob(b.guestName, b.guestPhone, guest),
  );
  const rentals: MotorbikeRental[] = (ops.motorbikeRentals ?? []).filter((b: any) =>
    matchesBlob(b.guestName, b.guestPhone, guest),
  );
  const foodOrders: FoodOrder[] = (ops.foodOrders ?? []).filter((o: any) =>
    matchesBlob(o.guestName, o.guestPhone, guest),
  );
  const messages: GuestMessage[] = (ops.guestMessages ?? []).filter((m: any) =>
    matchesBlob(m.guestName, m.guestPhone, guest),
  );

  return { bookings, tourBookings, rentals, foodOrders, messages, payments: [] };
}

/**
 * Loads the current guest's records. Merges authoritative Supabase records
 * with demo blob records (only when the same logical item isn't already
 * present — deduped by reference where possible, otherwise by id prefix).
 */
export function usePortalRecords(guest: PortalGuestIdentity | null) {
  const { data: cms } = useCms();
  const [records, setRecords] = useState<PortalRecordsUI>(emptyUI());
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!guest) {
      setRecords(emptyUI());
      return;
    }
    const supabaseRecords = await fetchGuestRecords(guest);
    const mapped = mapRecords(supabaseRecords);
    setRecords({ ...mapped, loading: false });
  }, [guest]);

  useEffect(() => {
    if (!guest) {
      setRecords(emptyUI());
      return;
    }
    let cancelled = false;

    const load = async () => {
      const supabaseRecords = await fetchGuestRecords(guest);
      if (cancelled) return;
      const mapped = mapRecords(supabaseRecords);

      // Demo fallback: merge blob records for anything Supabase didn't return.
      const blob = recordsFromBlob(cms, guest);
      const supRefs = new Set(
        [...mapped.bookings, ...mapped.tourBookings, ...mapped.rentals, ...mapped.foodOrders]
          .map((x) => x.reference)
          .filter(Boolean),
      );
      const blobItems = {
        bookings: blob.bookings.filter((b) => !supRefs.has(b.reference)),
        tourBookings: blob.tourBookings.filter((b) => !supRefs.has(b.reference)),
        rentals: blob.rentals.filter((b) => !supRefs.has(b.reference)),
        foodOrders: blob.foodOrders.filter((b) => !supRefs.has(b.reference)),
      };

      setRecords({
        bookings: [...mapped.bookings, ...blobItems.bookings],
        tourBookings: [...mapped.tourBookings, ...blobItems.tourBookings],
        rentals: [...mapped.rentals, ...blobItems.rentals],
        foodOrders: [...mapped.foodOrders, ...blobItems.foodOrders],
        messages: [...mapped.messages, ...blob.messages],
        payments: mapped.payments,
        loading: false,
      });
    };

    void load();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [guest, cms]);

  return { records, refresh };
}
