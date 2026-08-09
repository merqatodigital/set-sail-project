// Resort operations tool — reads REAL Marina Terrace bookings/guests from
// Supabase (server-side) so TallaAgent can answer operational questions about
// arrivals, departures, in-house occupancy, and tomorrow's picture. This is a
// real TallaAgent tool: the agent decides when to call it, gets structured
// observations, and reasons over them. OWNER/ADMIN ONLY.

import type { TallaTool } from "../types.js";
import { getResortOperations, type BookingRow } from "../../db/operations.js";

function summarizeBooking(b: BookingRow): string {
  return `${b.guestName} (${b.roomType}, ${b.guests} guests, ref ${b.reference}, status ${b.status})`;
}

export const getResortOperationsTool: TallaTool = {
  name: "getResortOperations",
  description:
    "Read the resort's real operational picture from the bookings system: current in-house guest count, tomorrow's arrivals, tomorrow's departures, and bookings spanning tomorrow. Use this when the owner asks about arrivals, departures, occupancy, who is in-house, or what to watch for tomorrow. OWNER/ADMIN ONLY.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (_args, ctx) => {
    try {
      const snap = await getResortOperations(ctx.env as any, ctx.tenantId);
      if (snap.readError) {
        return { success: false, error: snap.readError };
      }
      const out = {
        resortId: snap.resortId,
        inHouseCount: snap.inHouseCount,
        arrivalsTomorrow: snap.arrivalsTomorrow.map(summarizeBooking),
        departuresTomorrow: snap.departuresTomorrow.map(summarizeBooking),
        bookingsTomorrow: snap.bookingsTomorrow.map(summarizeBooking),
        rawBookingsChecked: snap.rawBookingsChecked,
      };
      return { success: true, data: out };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
