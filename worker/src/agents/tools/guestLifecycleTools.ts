// Guest lifecycle tools — unified stay state + deterministic service requests.
//
// All writes go to the AUTHORITATIVE Supabase tala_* tables (tours/rentals/
// payments) or the D1 guest_requests row for housekeeping (no Supabase
// housekeeping table exists yet). NO shadow copy: reads and writes share the
// same source of truth the Guest Portal / Admin uses.
//
// IDENTITY CONTINUITY: once a guest is identified in the session, write tools
// reuse ctx.guestName / ctx.guestPhone instead of re-asking. A guest can never
// read or write another guest's data — identity is injected from session state.

import type { TallaTool, ToolContext } from "../types.js";
import type { D1Database } from "@cloudflare/workers-types";
import {
  getGuestStayState,
  createTourRequest,
  findPendingTour,
  getTourPrice,
  createRentalRequest,
  findPendingRental,
  getBikeRate,
  createHousekeepingRequest,
  recordPayment,
  checkInGuest,
  checkOutGuest,
  confirmBookingRequest,
} from "../../db/repos/guestStateRepo.js";

function selfIdentity(ctx: ToolContext): { name?: string; phone?: string } {
  return {
    name: ctx.guestName ?? undefined,
    phone: ctx.guestPhone ?? undefined,
  };
}

// Owner/admin may override the target guest; guests are always self-scoped.
function resolveIdentity(
  ctx: ToolContext,
  args: Record<string, unknown>,
): { name?: string; phone?: string } {
  const isOwner = ctx.role === "owner" || ctx.role === "admin";
  const a = args as { guestName?: string; guestPhone?: string };
  if (isOwner && (a.guestName || a.guestPhone)) {
    return { name: a.guestName, phone: a.guestPhone };
  }
  return selfIdentity(ctx);
}

function requireIdentity(resolved: { name?: string; phone?: string }): string | null {
  // Prefer name; phone is optional but helpful for matching.
  if (resolved.name) return resolved.name;
  if (resolved.phone) return resolved.phone;
  return null;
}

// ---------------------------------------------------------------------------
// UNIFIED GUEST STAY STATE
// ---------------------------------------------------------------------------
export const getGuestStayStateTool: TallaTool = {
  name: "getGuestStayState",
  description:
    "Return the guest's COMPLETE operational state in one view: identity, booking + stay phase (before arrival / checked in / staying / checkout approaching / checked out), tours, rentals, food orders, reception messages, housekeeping requests, folio charges/payments/balance, and any outstanding actions. Use this when a guest asks for a stay summary, 'what's my status?', or 'what do I owe?'. Guests see only their own state; owner/admin may pass guestName/guestPhone.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = resolveIdentity(ctx, args as Record<string, unknown>);
    const id = requireIdentity(scope);
    if (!id) {
      return { success: false, error: "I need your name to look up your stay. Could you tell me your name?" };
    }
    try {
      const state = await getGuestStayState(ctx.env as never, ctx.db as D1Database, ctx.tenantId, scope);
      return { success: true, data: state };
    } catch (e) {
      return { success: false, error: "Could not read your stay state right now." };
    }
  },
};

// ---------------------------------------------------------------------------
// TOUR REQUEST — authoritative pricing from D1 tours_catalog
// ---------------------------------------------------------------------------
export const requestTourTool: TallaTool = {
  name: "requestTour",
  description:
    "Request a tour/activity for the guest. The server looks up the REAL tour price from the catalog (never trusts a guest-supplied price), creates ONE pending request in tala_tour_requests, and returns a short reference (TT-YYYYMMDD-XXXX). Required: guest name, tour name, tour date, guests. If the tour name is unknown, it will ask. Re-requesting the same tour/date/guests will return the existing reference instead of duplicating.",
  parameters: {
    type: "object",
    properties: {
      tourName: { type: "string", description: "Exact tour name from getTours" },
      tourDate: { type: "string", description: "ISO date YYYY-MM-DD" },
      guests: { type: "number", description: "Number of guests" },
      guestName: { type: "string", description: "Guest name (reused from session if omitted)" },
      guestPhone: { type: "string", description: "Guest phone (optional)" },
      notes: { type: "string", description: "Special requests (optional)" },
    },
    required: ["tourName", "tourDate", "guests"],
  },
  execute: async (args, ctx) => {
    const scope = resolveIdentity(ctx, args as Record<string, unknown>);
    const name = requireIdentity(scope);
    if (!name) {
      return { success: false, error: "May I have your name to request the tour?" };
    }
    const a = args as { tourName?: string; tourDate?: string; guests?: number; guestPhone?: string; notes?: string };
    if (!a.tourName || !a.tourDate || !a.guests) {
      return { success: false, error: "I need the tour name, date, and number of guests." };
    }
    try {
      // Authoritative price — never trust a model/guest-provided amount.
      const price = await getTourPrice(ctx.db as D1Database, ctx.tenantId, a.tourName);
      if (price === null) {
        return { success: false, error: `I couldn't find a tour called "${a.tourName}". Could you pick from the available tours?` };
      }
      // Dedupe.
      const existing = await findPendingTour(ctx.env as never, {
        guestName: name,
        tourName: a.tourName,
        tourDate: a.tourDate,
        guests: Number(a.guests),
      });
      if (existing) {
        return {
          success: true,
          data: { reference: existing.reference, status: "requested", amount: price, duplicate: true, message: `You already have a pending tour request (${existing.reference}). We'll keep that one.` },
        };
      }
      const res = await createTourRequest(ctx.env as never, {
        guestName: name,
        guestPhone: scope.phone ?? a.guestPhone ?? "",
        tourName: a.tourName,
        tourDate: a.tourDate,
        guests: Number(a.guests),
        amount: price,
        notes: a.notes,
      });
      return {
        success: true,
        data: { reference: res.reference, status: "requested", amount: price, duplicate: false, message: `Tour "${a.tourName}" requested for ${a.tourDate} (${a.guests} guest(s)). Reference ${res.reference}. Quoted ₱${price}. Pending staff confirmation.` },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

// ---------------------------------------------------------------------------
// RENTAL REQUEST — authoritative rate from Supabase motorbikes
// ---------------------------------------------------------------------------
export const requestRentalTool: TallaTool = {
  name: "requestRental",
  description:
    "Request a motorbike rental for the guest. The server looks up the REAL daily rate from motorbikes (never trusts a guest-supplied price), creates ONE pending request in tala_rental_requests, and returns a short reference (MR-YYYYMMDD-XXXX). Required: guest name, bike name, start date, end date. Re-requesting the same bike/dates returns the existing reference instead of duplicating.",
  parameters: {
    type: "object",
    properties: {
      bikeName: { type: "string", description: "Motorbike name from inventory" },
      startDate: { type: "string", description: "ISO date YYYY-MM-DD" },
      endDate: { type: "string", description: "ISO date YYYY-MM-DD" },
      guestName: { type: "string", description: "Guest name (reused from session if omitted)" },
      guestPhone: { type: "string", description: "Guest phone (optional)" },
      notes: { type: "string", description: "Notes (optional)" },
    },
    required: ["bikeName", "startDate", "endDate"],
  },
  execute: async (args, ctx) => {
    const scope = resolveIdentity(ctx, args as Record<string, unknown>);
    const name = requireIdentity(scope);
    if (!name) {
      return { success: false, error: "May I have your name to request the rental?" };
    }
    const a = args as { bikeName?: string; startDate?: string; endDate?: string; guestPhone?: string; notes?: string };
    if (!a.bikeName || !a.startDate || !a.endDate) {
      return { success: false, error: "I need the bike name, start date, and end date." };
    }
    try {
      const rate = await getBikeRate(ctx.env as never, a.bikeName);
      if (rate === null) {
        return { success: false, error: `I couldn't find a motorbike called "${a.bikeName}". Could you pick from the available bikes?` };
      }
      const existing = await findPendingRental(ctx.env as never, {
        guestName: name,
        bikeName: a.bikeName,
        startDate: a.startDate,
        endDate: a.endDate,
      });
      if (existing) {
        return {
          success: true,
          data: { reference: existing.reference, status: "requested", dailyRate: rate, duplicate: true, message: `You already have a pending rental request (${existing.reference}). We'll keep that one.` },
        };
      }
      const res = await createRentalRequest(ctx.env as never, {
        guestName: name,
        guestPhone: scope.phone ?? a.guestPhone ?? "",
        bikeName: a.bikeName,
        startDate: a.startDate,
        endDate: a.endDate,
        notes: a.notes,
      });
      return {
        success: true,
        data: { reference: res.reference, status: "requested", dailyRate: rate, duplicate: false, message: `Motorbike "${a.bikeName}" requested ${a.startDate} to ${a.endDate}. Reference ${res.reference}. Daily rate ₱${rate}. Pending staff confirmation.` },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

// ---------------------------------------------------------------------------
// HOUSEKEEPING REQUEST — deterministic, D1 guest_requests (no Supabase table)
// ---------------------------------------------------------------------------
export const requestHousekeepingTool: TallaTool = {
  name: "requestHousekeeping",
  description:
    "Request a housekeeping task (cleaning, laundry, maintenance, inspection, other) for a room/cabana. Creates ONE pending request and returns a short reference (HK-YYYYMMDD-XXXX). Required: room/location. Status starts at 'pending' — staff confirm and complete it.",
  parameters: {
    type: "object",
    properties: {
      room: { type: "string", description: "Room or location (e.g. 'Cabana 3')" },
      taskType: { type: "string", enum: ["cleaning", "laundry", "maintenance", "inspection", "other"], description: "Task type (default cleaning)" },
      priority: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Priority (default normal)" },
      notes: { type: "string", description: "Details (optional)" },
    },
    required: ["room"],
  },
  execute: async (args, ctx) => {
    const scope = selfIdentity(ctx);
    const name = requireIdentity(scope);
    if (!name) {
      return { success: false, error: "May I have your name for the housekeeping request?" };
    }
    const a = args as { room?: string; taskType?: string; priority?: string; notes?: string };
    if (!a.room) {
      return { success: false, error: "Which room or location needs housekeeping?" };
    }
    try {
      const res = await createHousekeepingRequest(ctx.db as D1Database, ctx.tenantId, {
        guestName: name,
        room: a.room,
        taskType: a.taskType ?? "cleaning",
        priority: a.priority ?? "normal",
        notes: a.notes,
      });
      return {
        success: true,
        data: { reference: res.reference, status: "pending", message: `Housekeeping (${a.taskType ?? "cleaning"}) requested for ${a.room}. Reference ${res.reference}.` },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

// ---------------------------------------------------------------------------
// OWNER/ADMIN ONLY — payments, check-in, check-out
// ---------------------------------------------------------------------------
function ownerOnly(ctx: ToolContext): boolean {
  return ctx.role === "owner" || ctx.role === "admin";
}

export const recordPaymentTool: TallaTool = {
  name: "recordPayment",
  description:
    "OWNER/ADMIN ONLY. Record an explicit guest payment into the folio (tala_folio_lines, kind=payment). Payments are NEVER auto-confirmed by guests. Returns a short PAY reference. Required: guestName, amount, method.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Guest name" },
      guestPhone: { type: "string", description: "Guest phone (optional)" },
      amount: { type: "number", description: "Amount paid (PHP)" },
      method: { type: "string", enum: ["cash", "gcash", "bank_transfer", "card", "other"], description: "Payment method" },
      relatedType: { type: "string", description: "Optional link type (booking|tour|rental|food)" },
      relatedId: { type: "string", description: "Optional linked record id/reference" },
    },
    required: ["guestName", "amount", "method"],
  },
  execute: async (args, ctx) => {
    if (!ownerOnly(ctx)) return { success: false, error: "Only staff can record payments." };
    const a = args as { guestName?: string; guestPhone?: string; amount?: number; method?: string; relatedType?: string; relatedId?: string };
    if (!a.guestName || a.amount == null || !a.method) {
      return { success: false, error: "guestName, amount and method are required." };
    }
    try {
      const res = await recordPayment(ctx.env as never, {
        guestName: a.guestName,
        guestPhone: a.guestPhone ?? "",
        amount: Number(a.amount),
        method: a.method,
        relatedType: a.relatedType,
        relatedId: a.relatedId,
      });
      return { success: true, data: { reference: res.reference, message: `Payment of ₱${a.amount} recorded (${a.method}). Reference ${res.reference}.` } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

export const checkInGuestTool: TallaTool = {
  name: "checkInGuest",
  description:
    "OWNER/ADMIN ONLY. Mark a confirmed booking as checked_in on the authoritative bookings table. Prefer the exact booking reference; otherwise guestName + roomType + checkIn. Required: reference OR (guestName + roomType + checkIn).",
  parameters: {
    type: "object",
    properties: {
      reference: { type: "string", description: "Exact booking reference (MT-YYYYMMDD-XXXX). Preferred." },
      guestName: { type: "string", description: "Guest name" },
      roomType: { type: "string", description: "Room type" },
      checkIn: { type: "string", description: "Check-in date YYYY-MM-DD" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    if (!ownerOnly(ctx)) return { success: false, error: "Only staff can check a guest in." };
    const a = args as { reference?: string; guestName?: string; roomType?: string; checkIn?: string };
    if (!a.reference && (!a.guestName || !a.roomType || !a.checkIn)) {
      return { success: false, error: "reference, or guestName + roomType + checkIn, are required." };
    }
    try {
      const r = await checkInGuest(ctx.env as never, { reference: a.reference, guestName: a.guestName, roomType: a.roomType, checkIn: a.checkIn });
      if (!r.ok) return { success: false, error: r.error };
      // Zero-row guard: a successful HTTP with no matched row is a failure.
      if (!r.changed || r.changed < 1) return { success: false, error: "No matching booking found to check in." };
      return { success: true, data: { message: `${a.guestName ?? a.reference} checked in (${r.changed} row).` } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

export const checkOutGuestTool: TallaTool = {
  name: "checkOutGuest",
  description:
    "OWNER/ADMIN ONLY. Mark a stay as checked_out and report any unresolved services / outstanding balance via getGuestStayState first. Prefer the exact booking reference; otherwise guestName + roomType + checkIn. Guests can NEVER self-checkout or self-settle.",
  parameters: {
    type: "object",
    properties: {
      reference: { type: "string", description: "Exact booking reference (MT-YYYYMMDD-XXXX). Preferred." },
      guestName: { type: "string", description: "Guest name" },
      roomType: { type: "string", description: "Room type" },
      checkIn: { type: "string", description: "Check-in date YYYY-MM-DD" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    if (!ownerOnly(ctx)) return { success: false, error: "Only staff can check a guest out." };
    const a = args as { reference?: string; guestName?: string; roomType?: string; checkIn?: string };
    if (!a.reference && (!a.guestName || !a.roomType || !a.checkIn)) {
      return { success: false, error: "reference, or guestName + roomType + checkIn, are required." };
    }
    try {
      // Surface outstanding items before closing the stay.
      const state = await getGuestStayState(ctx.env as never, ctx.db as D1Database, ctx.tenantId, { name: a.guestName });
      const r = await checkOutGuest(ctx.env as never, { reference: a.reference, guestName: a.guestName, roomType: a.roomType, checkIn: a.checkIn });
      if (!r.ok) return { success: false, error: r.error };
      if (!r.changed || r.changed < 1) return { success: false, error: "No matching booking found to check out." };
      return {
        success: true,
        data: {
          message: `${a.guestName ?? a.reference} checked out (${r.changed} row).`,
          outstanding: state.outstanding,
          balance: state.folio.balance,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

export const confirmBookingTool: TallaTool = {
  name: "confirmBooking",
  description:
    "OWNER/ADMIN ONLY. Confirm a pending room booking request and promote it into the operational bookings table. Identifies the request by its exact reference (MT-YYYYMMDD-XXXX). Idempotent: confirming twice never creates a duplicate bookings row. After this, the guest's stay is 'confirmed' and can be checked in/out.",
  parameters: {
    type: "object",
    properties: {
      reference: { type: "string", description: "Exact booking request reference (MT-YYYYMMDD-XXXX) to confirm" },
    },
    required: ["reference"],
  },
  execute: async (args, ctx) => {
    if (!ownerOnly(ctx)) return { success: false, error: "Only staff can confirm a booking." };
    const a = args as { reference?: string };
    if (!a.reference) return { success: false, error: "reference is required." };
    try {
      const r = await confirmBookingRequest(ctx.env as never, { reference: a.reference });
      if (!r.ok) return { success: false, error: r.error };
      return {
        success: true,
        data: {
          message: `Booking ${r.reference} confirmed. Operational booking created (id ${r.bookingId}).`,
          reference: r.reference,
          bookingId: r.bookingId,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};
