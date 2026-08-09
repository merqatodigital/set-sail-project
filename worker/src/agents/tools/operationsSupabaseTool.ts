// Resort operations tool — reads REAL Marina Terrace bookings/guests from
// Supabase (server-side) so TallaAgent can answer operational questions about
// arrivals, departures, in-house occupancy, outstanding balances, and booking
// notes/special requests. This is a real TallaAgent tool: the agent decides
// when to call it, gets structured observations, and reasons over them.
// OWNER/ADMIN ONLY.

import type { TallaTool } from "../types.js";
import { getResortOperations, type BookingRow } from "../../db/operations.js";

function summarizeBooking(b: BookingRow): string {
  const parts = [
    `${b.guestName} (${b.roomType}, ${b.guests} guests, ref ${b.reference}, status ${b.status})`,
  ];
  if (b.amount || b.paidAmount) {
    const bal = b.outstandingBalance > 0 ? `, balance ₱${b.outstandingBalance}` : ", fully paid";
    parts.push(`amount ₱${b.amount}, paid ₱${b.paidAmount}${bal}`);
  }
  if (b.notes && b.notes.trim()) parts.push(`note: ${b.notes.trim()}`);
  return parts.join(" — ");
}

export const getResortOperationsTool: TallaTool = {
  name: "getResortOperations",
  description:
    "Read the resort's real operational picture from the bookings system: current in-house guest count, tomorrow's arrivals, tomorrow's departures, bookings spanning tomorrow, each booking's outstanding balance (amount minus paid), and any special notes/requests. Use this when the owner asks about arrivals, departures, occupancy, outstanding balances, special requests, or what to watch for tomorrow. OWNER/ADMIN ONLY.",
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
      const outstandingBalances = snap.arrivalsTomorrow
        .concat(snap.departuresTomorrow)
        .concat(snap.bookingsTomorrow)
        .concat(
          // also include any in-house / active booking with a balance
          (snap as any).inHouseBookings ?? [],
        )
        .filter((b) => b.outstandingBalance > 0)
        .map((b) => ({ guest: b.guestName, reference: b.reference, balance: b.outstandingBalance }));
      const out = {
        resortId: snap.resortId,
        inHouseCount: snap.inHouseCount,
        arrivalsTomorrow: snap.arrivalsTomorrow.map(summarizeBooking),
        departuresTomorrow: snap.departuresTomorrow.map(summarizeBooking),
        bookingsTomorrow: snap.bookingsTomorrow.map(summarizeBooking),
        outstandingBalances,
        rawBookingsChecked: snap.rawBookingsChecked,
      };
      return { success: true, data: out };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
