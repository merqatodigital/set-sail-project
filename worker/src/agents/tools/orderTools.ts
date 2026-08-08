// Food order tools — creates food orders via Phase 4 repo.
// CRITICAL: Prices are authoritative from D1. LLM-provided prices are IGNORED.

import type { TallaTool } from "../types.js";
import { createFoodOrder } from "../../db/repos/foodOrderRepo.js";
import { listMenuItems } from "../../db/repos/menuRepo.js";

export const createFoodOrderTool: TallaTool = {
  name: "createFoodOrder",
  description:
    "Place a food or drink order. The server will look up each item by name in the menu, verify availability, and calculate the total from authoritative D1 prices. You must provide the guest name and at least one item with quantity. IMPORTANT: Do NOT include prices in your call — the server calculates prices from the menu.",
  parameters: {
    type: "object",
    properties: {
      guestName: {
        type: "string",
        description: "The guest's name or room/cabana identifier",
      },
      guestPhone: {
        type: "string",
        description: "Guest phone number (optional)",
      },
      notes: {
        type: "string",
        description: "Special instructions or notes (optional)",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            menuItemId: {
              type: "string",
              description: "The menu item ID (from getMenu tool)",
            },
            quantity: {
              type: "number",
              description: "Quantity to order (1-100)",
            },
            specialInstructions: {
              type: "string",
              description: "Special instructions for this item (optional)",
            },
          },
          required: ["menuItemId", "quantity"],
        },
        description: "Array of items to order",
      },
    },
    required: ["guestName", "items"],
  },
  execute: async (args, ctx) => {
    try {
      const items = args.items as Array<{
        menuItemId: string;
        quantity: number;
        specialInstructions?: string;
      }>;

      // Validate items
      if (!items || items.length === 0) {
        return { success: false, error: "At least one item is required" };
      }

      for (const item of items) {
        if (item.quantity <= 0) {
          return { success: false, error: `Invalid quantity for item ${item.menuItemId}: ${item.quantity}` };
        }
        if (item.quantity > 100) {
          return { success: false, error: `Excessive quantity for item ${item.menuItemId}: ${item.quantity}` };
        }
      }

      // Load authoritative menu items from D1
      const menuItems = await listMenuItems(ctx.db, ctx.tenantId, { activeOnly: true });

      // Create the order — server calculates totals from authoritative prices
      const order = await createFoodOrder(
        ctx.db,
        ctx.tenantId,
        {
          guestName: args.guestName as string,
          guestPhone: (args.guestPhone as string) || "",
          notes: (args.notes as string) || "",
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions,
          })),
        },
        menuItems,
      );

      // Build item summary for confirmation
      const itemSummary = order.items.map(
        (i) => `${i.quantity}x ${i.name} (₱${i.price} each)`,
      );

      return {
        success: true,
        data: {
          orderId: order.id,
          reference: order.reference,
          items: itemSummary,
          total: order.total,
          status: order.status,
          message: `Order ${order.reference} placed. Total: ₱${order.total}. ${itemSummary.join(", ")}`,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
