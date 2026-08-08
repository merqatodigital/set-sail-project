// Inventory tools — reads authoritative inventory data from D1.

import type { TallaTool } from "../types.js";
import { listInventory } from "../../db/repos/inventoryRepo.js";

export const getInventoryTool: TallaTool = {
  name: "getInventory",
  description:
    "Check current inventory levels for supplies, food, cleaning materials, or other stock items. Use this when asked about stock availability, low inventory, or supply levels.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Optional category filter: 'linens', 'towels', 'bathroom', 'food', 'gas', 'fuel', 'cleaning', 'other'",
      },
      lowStock: {
        type: "boolean",
        description: "If true, only return items at or below reorder threshold",
      },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    try {
      const items = await listInventory(ctx.db, ctx.tenantId, {
        category: args.category as string | undefined,
        lowStock: args.lowStock as boolean | undefined,
      });

      if (items.length === 0) {
        return { success: true, data: { message: "No inventory items found" } };
      }

      return {
        success: true,
        data: items.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          lowStock: item.reorderThreshold > 0 && item.quantity <= item.reorderThreshold,
        })),
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
