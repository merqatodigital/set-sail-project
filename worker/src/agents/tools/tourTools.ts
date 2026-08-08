// Tour tools — reads authoritative tour catalog from D1.

import type { TallaTool } from "../types.js";
import { listActiveTours } from "../../db/repos/toursRepo.js";

export const getToursTool: TallaTool = {
  name: "getTours",
  description:
    "Get the list of available tours and activities. Use this when a guest asks about tours, activities, things to do, or excursion options. Returns tour names, descriptions, durations, prices, and capacities.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (_args, ctx) => {
    try {
      const tours = await listActiveTours(ctx.db, ctx.tenantId);

      if (tours.length === 0) {
        return { success: true, data: { message: "No tours currently available" } };
      }

      return {
        success: true,
        data: tours.map((t) => ({
          name: t.name,
          description: t.description,
          duration: t.duration,
          price: t.price,
          capacity: t.capacity,
        })),
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
