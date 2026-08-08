// Maintenance tools — creates maintenance requests via Phase 4 repo.

import type { TallaTool } from "../types.js";
import { createMaintenanceRequest } from "../../db/repos/maintenanceRepo.js";

export const createMaintenanceRequestTool: TallaTool = {
  name: "createMaintenanceRequest",
  description:
    "Create a maintenance request for broken equipment, repairs, plumbing, electrical issues, or other property maintenance needs. Use this when a guest reports something broken, leaking, not working, or when maintenance is needed.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Brief title of the issue (e.g. 'AC not cooling', 'Leaky faucet')",
      },
      description: {
        type: "string",
        description: "Detailed description of the problem (optional)",
      },
      location: {
        type: "string",
        description: "Where the issue is located (e.g. 'Cabana 3', 'Room 101 bathroom')",
      },
      issueType: {
        type: "string",
        enum: ["plumbing", "electrical", "structural", "furniture", "appliance", "other"],
        description: "Type of issue (defaults to 'other')",
      },
      priority: {
        type: "string",
        enum: ["low", "normal", "high", "urgent"],
        description: "Priority level (defaults to 'normal')",
      },
      notes: {
        type: "string",
        description: "Additional details (optional)",
      },
    },
    required: ["title"],
  },
  execute: async (args, ctx) => {
    try {
      const request = await createMaintenanceRequest(ctx.db, ctx.tenantId, {
        title: args.title as string,
        description: (args.description as string) || "",
        location: (args.location as string) || "",
        issueType: (args.issueType as string) || "other",
        priority: (args.priority as string) || "normal",
        notes: (args.notes as string) || "",
      });

      return {
        success: true,
        data: {
          id: request.id,
          title: request.title,
          location: request.location,
          status: request.status,
          message: `Maintenance request created: ${request.title}. Request ID: ${request.id}`,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
