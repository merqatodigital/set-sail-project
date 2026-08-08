// Menu tools — reads authoritative menu items from D1.
// CRITICAL: Prices come from D1, never from the LLM.

import type { TallaTool } from "../types.js";
import { listMenuItems } from "../../db/repos/menuRepo.js";

export const getMenuTool: TallaTool = {
  name: "getMenu",
  description:
    "Get the current food and drink menu with prices and availability. Use this when a guest asks about food, drinks, menu items, meal options, or prices. Returns items grouped by category with authoritative prices and stock counts.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Optional category filter: 'breakfast', 'lunch', 'dinner', 'drinks', 'snacks', 'dessert'. Leave empty for full menu.",
      },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    try {
      const category = args.category as string | undefined;
      const items = await listMenuItems(ctx.db, ctx.tenantId, {
        activeOnly: true,
        category,
      });

      if (items.length === 0) {
        return { success: true, data: { message: "No menu items currently available" } };
      }

      return {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          price: item.price,
          available: item.inventoryCount > 0,
          stock: item.inventoryCount,
        })),
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
