// Property information tool — reads authoritative property settings from D1.

import type { TallaTool } from "../types.js";
import { getAllSettings } from "../../db/repos/propertySettingsRepo.js";

export const getPropertyInfoTool: TallaTool = {
  name: "getPropertyInfo",
  description:
    "Get resort property information such as contact details, address, hours, amenities, and general settings. Use this when a guest asks about the resort, its facilities, contact info, or general property details.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Optional category to filter by (e.g. 'contact', 'seo', 'theme'). Leave empty for all settings.",
      },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    try {
      const category = args.category as string | undefined;
      let settings;

      if (category) {
        const { getSettingsByCategory } = await import("../../db/repos/propertySettingsRepo.js");
        settings = await getSettingsByCategory(ctx.db, ctx.tenantId, category);
      } else {
        settings = await getAllSettings(ctx.db, ctx.tenantId);
      }

      // Convert to a simple key-value record for the LLM
      const info: Record<string, string> = {};
      for (const s of settings) {
        info[s.key] = s.value;
      }

      return {
        success: true,
        data: Object.keys(info).length > 0 ? info : { message: "No property settings found" },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
