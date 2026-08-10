// requestRoomBooking — deterministic room-booking contract for TALA.
//
// HARD ENFORCEMENT (not prompt-only): the tool refuses to write a row unless ALL
// required fields are present. If any are missing it returns structured
// `requiresInput: true, missingFields:[...]` and writes NOTHING, so the SAME
// TallaAgent naturally asks only for the missing pieces. When all present it
// inserts exactly ONE pending tala_booking_requests row with a short human
// reference (MT-YYYYMMDD-XXXX) and persists contact data. Duplicate submissions
// in the same conversation return the existing pending reference instead.

import type { TallaTool, ToolResult } from "../types.js";
import { createBookingRequest, findPendingBooking, type BookingRequestResult } from "../../db/repos/guestStateRepo.js";
import { logGuestState } from "../../db/repos/guestStateLogRepo.js";

const REQUIRED = ["guestName", "guestEmail", "guestPhone", "roomType", "checkIn", "checkOut", "guests"] as const;
type Field = (typeof REQUIRED)[number];

function missingFields(a: Record<string, unknown>): Field[] {
  const out: Field[] = [];
  for (const f of REQUIRED) {
    const v = a[f];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (f === "guests" && (typeof v !== "number" || v < 1))) {
      out.push(f);
    }
  }
  return out;
}

function validDateRange(checkIn: string, checkOut: string): boolean {
  const ci = Date.parse(checkIn);
  const co = Date.parse(checkOut);
  return !isNaN(ci) && !isNaN(co) && co > ci;
}

export const requestRoomBookingTool: TallaTool = {
  name: "requestRoomBooking",
  description:
    "Create a ROOM BOOKING REQUEST (status pending — owner/admin confirms later). This is the ONLY tool that creates a booking. It requires guestName, guestEmail, guestPhone, roomType, checkIn, checkOut and guests. If any are missing it returns requiresInput with missingFields and creates nothing. Use it only after the guest has provided all of those. Never show the internal UUID to the guest; the tool returns a short reference like MT-20260810-4821.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Guest full name" },
      guestEmail: { type: "string", description: "Guest email address" },
      guestPhone: { type: "string", description: "Guest WhatsApp or mobile number" },
      roomType: { type: "string", description: "Requested room type, e.g. Superior Room UNO" },
      checkIn: { type: "string", description: "ISO check-in date YYYY-MM-DD" },
      checkOut: { type: "string", description: "ISO check-out date YYYY-MM-DD" },
      guests: { type: "number", description: "Number of guests (>=1)" },
      notes: { type: "string", description: "Optional special requests" },
    },
    required: [...REQUIRED],
  },
  execute: async (args, ctx) => {
    try {
      // Reuse session identity for guestName if the LLM omitted it (conversation memory).
      const effective = { ...(args as Record<string, unknown>) };
      if (!effective.guestName && ctx.guestName) effective.guestName = ctx.guestName;

      const missing = missingFields(effective);
      if (missing.length > 0) {
        await logGuestState(ctx.db, {
          tenantId: ctx.tenantId,
          tool: "requestRoomBooking",
          role: ctx.role ?? "guest",
          guestName: String(effective.guestName ?? ""),
          success: false,
          error: `missing: ${missing.join(",")}`,
        });
        return {
          success: false,
          requiresInput: true,
          missingFields: missing,
          message: `Missing required booking fields: ${missing.join(", ")}.`,
        } as unknown as ToolResult;
      }

      if (!validDateRange(String(effective.checkIn), String(effective.checkOut))) {
        return {
          success: false,
          error: "Invalid date range: check-out must be after check-in (YYYY-MM-DD).",
        };
      }

      const input = {
        guestName: String(effective.guestName),
        guestEmail: String(effective.guestEmail),
        guestPhone: String(effective.guestPhone),
        roomType: String(effective.roomType),
        checkIn: String(effective.checkIn),
        checkOut: String(effective.checkOut),
        guests: Number(effective.guests),
        notes: (effective.notes as string) ?? "",
      };

      // Duplicate guard: same guest/room/dates/guests already pending -> return it.
      const dup = await findPendingBooking(ctx.env as never, {
        guestName: input.guestName,
        roomType: input.roomType,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
      }).catch(() => null);
      if (dup && dup.reference) {
        await logGuestState(ctx.db, {
          tenantId: ctx.tenantId,
          tool: "requestRoomBooking",
          role: ctx.role ?? "guest",
          guestName: input.guestName,
          success: true,
        });
        return {
          success: true,
          duplicate: true,
          reference: dup.reference,
          status: "pending",
          message: `You already have a pending booking request (reference ${dup.reference}). We'll confirm shortly.`,
        } as unknown as ToolResult;
      }

      const res: BookingRequestResult = await createBookingRequest(ctx.env as never, input);
      await logGuestState(ctx.db, {
        tenantId: ctx.tenantId,
        tool: "requestRoomBooking",
        role: ctx.role ?? "guest",
        guestName: input.guestName,
        success: true,
      });
      return {
        success: true,
        reference: res.reference,
        status: "pending",
        guestName: input.guestName,
        roomType: input.roomType,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        message: `Booking request received (pending). Reference ${res.reference}. We'll confirm shortly.`,
      } as unknown as ToolResult;
    } catch (e) {
      await logGuestState(ctx.db, {
        tenantId: ctx.tenantId,
        tool: "requestRoomBooking",
        role: ctx.role ?? "guest",
        guestName: String((args as Record<string, unknown>).guestName ?? ctx.guestName ?? ""),
        success: false,
        error: String(e),
      });
      return { success: false, error: "Could not create booking request." };
    }
  },
};
