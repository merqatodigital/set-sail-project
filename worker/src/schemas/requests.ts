// Zod validation schemas for guest request write operations.
// Validates all input server-side before touching D1.

import { z } from "zod";

export const CreateGuestRequestSchema = z.object({
  type: z.enum(["booking", "tour", "rental", "housekeeping", "maintenance", "general"], {
    message: "Invalid request type",
  }),
  guestName: z
    .string()
    .min(1, "Guest name is required")
    .max(200, "Guest name too long")
    .trim(),
  guestPhone: z.string().max(50).optional().default(""),
  guestEmail: z.string().email().max(200).optional().default(""),
  roomType: z.string().max(200).optional().default(""),
  checkIn: z.string().optional().default(""),
  checkOut: z.string().optional().default(""),
  tourName: z.string().max(200).optional().default(""),
  tourDate: z.string().optional().default(""),
  bikeName: z.string().max(200).optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  guests: z.number().int().min(1).max(100).optional().default(1),
  amount: z.number().min(0).max(10_000_000).optional().default(0),
  notes: z.string().max(2000).optional().default(""),
  source: z.string().max(50).optional().default("talla_chat"),
});

export type CreateGuestRequestInput = z.infer<typeof CreateGuestRequestSchema>;

export const UpdateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed"], {
    message: "Invalid status value",
  }),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
