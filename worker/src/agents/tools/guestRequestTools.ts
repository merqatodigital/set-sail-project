// Guest request tools — creates guest requests via Phase 4 repo.

import type { TallaTool } from "../types.js";
import { createGuestRequest } from "../../db/repos/guestRequestRepo.js";

export const createGuestRequestTool: TallaTool = {
  name: "createGuestRequest",
  description:
    "Submit a guest request for tours, rentals, housekeeping, maintenance, or general requests. Use this when a guest wants to request something that should be handled by resort staff. The server will generate the request ID and set initial status to pending. ROOM BOOKINGS are NOT handled here — use requestRoomBooking for those.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["tour", "rental", "housekeeping", "maintenance", "general"],
        description: "The type of request",
      },
      guestName: {
        type: "string",
        description: "The guest's name",
      },
      guestPhone: {
        type: "string",
        description: "The guest's phone number (optional)",
      },
      guestEmail: {
        type: "string",
        description: "The guest's email address (optional)",
      },
      roomType: {
        type: "string",
        description: "Room type for booking requests (optional)",
      },
      checkIn: {
        type: "string",
        description: "Check-in date for booking requests (optional)",
      },
      checkOut: {
        type: "string",
        description: "Check-out date for booking requests (optional)",
      },
      tourName: {
        type: "string",
        description: "Tour name for tour requests (optional)",
      },
      tourDate: {
        type: "string",
        description: "Tour date for tour requests (optional)",
      },
      guests: {
        type: "number",
        description: "Number of guests (optional, defaults to 1)",
      },
      amount: {
        type: "number",
        description: "Amount in PHP (optional, will be verified against authoritative pricing)",
      },
      notes: {
        type: "string",
        description: "Additional notes or special requests (optional)",
      },
    },
    required: ["type", "guestName"],
  },
  execute: async (args, ctx) => {
    try {
      const record = await createGuestRequest(ctx.db, ctx.tenantId, {
        type: args.type as string,
        guestName: args.guestName as string,
        guestPhone: (args.guestPhone as string) || "",
        guestEmail: (args.guestEmail as string) || "",
        roomType: (args.roomType as string) || "",
        checkIn: (args.checkIn as string) || "",
        checkOut: (args.checkOut as string) || "",
        tourName: (args.tourName as string) || "",
        tourDate: (args.tourDate as string) || "",
        guests: (args.guests as number) || 1,
        amount: (args.amount as number) || 0,
        notes: (args.notes as string) || "",
      });

      return {
        success: true,
        data: {
          id: record.id,
          type: record.type,
          status: record.status,
          message: `Request submitted successfully. Reference: ${record.id}`,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
