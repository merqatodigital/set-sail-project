// TallaAgent guest-state adapter tools. These let TALA read/write the SAME
// persistent Supabase truth the Guest Portal uses, so a guest can ask
// "what tours do I have?", "is my food ready?", "how much do I owe?", and
// TALA answers from REAL records (no invented state).
//
// ROLE SECURITY: a guest may only read their OWN state (identity comes from the
// session context, never from a guest-supplied name). Owner/admin may pass a
// guest name/phone to look up another guest. Messages are written by TALA/owner
// into tala_guest_messages (the Portal inbox source).

import type { TallaTool, ToolContext, ToolResult } from "../types.js";
import type { D1Database } from "@cloudflare/workers-types";
import {
  getGuestStay,
  getGuestTourRequests,
  getGuestMotorbikeState,
  getGuestFoodOrders,
  getGuestMessages,
  getGuestFolio,
  writeGuestMessage,
  type GuestFolio,
} from "../../db/repos/guestStateRepo.js";
import { logGuestState } from "../../db/repos/guestStateLogRepo.js";

function identity(ctx: ToolContext): { name?: string; phone?: string } {
  const name = ctx.guestName ?? undefined;
  const phone = ctx.guestPhone ?? undefined;
  return { name, phone };
}

function scopeArgs(ctx: ToolContext, args: Record<string, unknown>): { name?: string; phone?: string } {
  const isOwner = ctx.role === "owner" || ctx.role === "admin";
  if (isOwner) {
    const a = args as { guestName?: string; guestPhone?: string };
    return { name: a.guestName, phone: a.guestPhone };
  }
  // Guest: never trust a supplied name — use session identity only.
  return identity(ctx);
}

function deny(): ToolResult {
  return { success: false, error: "You can only view your own booking and service information." };
}

function identityProvided(s: { name?: string; phone?: string }): boolean {
  return Boolean(s.name || s.phone);
}

async function audit(
  db: D1Database,
  ctx: ToolContext,
  tool: string,
  success: boolean,
  error?: string,
) {
  await logGuestState(db, {
    tenantId: ctx.tenantId,
    tool,
    role: ctx.role ?? "guest",
    guestName: ctx.guestName ?? "",
    success,
    error,
  });
}

export const getGuestStayTool: TallaTool = {
  name: "getGuestStay",
  description:
    "Read the guest's own room/stay record: room type, check-in, check-out, status, amount and amount paid. Use when a guest asks 'when do I check out?', 'what room am I in?', or 'what is my stay status?'. Guest sees only their own stay; owner/admin may pass a guestName.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = scopeArgs(ctx, args as Record<string, unknown>);
    if (ctx.role !== "owner" && ctx.role !== "admin" && !identityProvided(identity(ctx))) {
      await audit(ctx.db, ctx, "getGuestStay", false, "no self identity");
      return deny();
    }
    try {
      const rows = await getGuestStay(ctx.env as never, scope);
      await audit(ctx.db, ctx, "getGuestStay", true);
      return { success: true, data: rows };
    } catch (e) {
      await audit(ctx.db, ctx, "getGuestStay", false, String(e));
      return { success: false, error: "Could not read stay record." };
    }
  },
};

export const getGuestTourRequestsTool: TallaTool = {
  name: "getGuestTourRequests",
  description:
    "Read the guest's own requested tours (from tala_tour_requests): tour name, date, guests, quoted amount and status. Use when a guest asks 'what tours did I request?', 'has my tour been confirmed?'. Guest sees only their own; owner/admin may pass a guestName. (Catalog of available tours is a separate tool: getTours.)",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = scopeArgs(ctx, args as Record<string, unknown>);
    if (ctx.role !== "owner" && ctx.role !== "admin" && !identityProvided(identity(ctx))) {
      await audit(ctx.db, ctx, "getGuestTourRequests", false, "no self identity");
      return deny();
    }
    try {
      const rows = await getGuestTourRequests(ctx.env as never, scope);
      await audit(ctx.db, ctx, "getGuestTourRequests", true);
      return { success: true, data: rows };
    } catch (e) {
      await audit(ctx.db, ctx, "getGuestTourRequests", false, String(e));
      return { success: false, error: "Could not read tour requests." };
    }
  },
};

export const getGuestMotorbikeStateTool: TallaTool = {
  name: "getGuestMotorbikeState",
  description:
    "Read the guest's own motorbike request and/or active rental: bike, start/end dates, status, and the configured daily rate. Use when a guest asks 'what bike do I have?', 'can I extend my rental?'. Guest sees only their own; owner/admin may pass a guestName. (Inventory/rates are a separate source; this reads the guest's actual request/rental.)",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = scopeArgs(ctx, args as Record<string, unknown>);
    if (ctx.role !== "owner" && ctx.role !== "admin" && !identityProvided(identity(ctx))) {
      await audit(ctx.db, ctx, "getGuestMotorbikeState", false, "no self identity");
      return deny();
    }
    try {
      const rows = await getGuestMotorbikeState(ctx.env as never, scope);
      await audit(ctx.db, ctx, "getGuestMotorbikeState", true);
      return { success: true, data: rows };
    } catch (e) {
      await audit(ctx.db, ctx, "getGuestMotorbikeState", false, String(e));
      return { success: false, error: "Could not read motorbike state." };
    }
  },
};

export const getGuestFoodOrdersTool: TallaTool = {
  name: "getGuestFoodOrders",
  description:
    "Read the guest's own food & drinks orders (from tala_food_orders): items, total, status (pending/confirmed/preparing/ready/delivered), and timestamps. Use when a guest asks 'is my food ready?', 'what did I order?'. Guest sees only their own; owner/admin may pass a guestName.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = scopeArgs(ctx, args as Record<string, unknown>);
    if (ctx.role !== "owner" && ctx.role !== "admin" && !identityProvided(identity(ctx))) {
      await audit(ctx.db, ctx, "getGuestFoodOrders", false, "no self identity");
      return deny();
    }
    try {
      const rows = await getGuestFoodOrders(ctx.env as never, scope);
      await audit(ctx.db, ctx, "getGuestFoodOrders", true);
      return { success: true, data: rows };
    } catch (e) {
      await audit(ctx.db, ctx, "getGuestFoodOrders", false, String(e));
      return { success: false, error: "Could not read food orders." };
    }
  },
};

export const getGuestMessagesTool: TallaTool = {
  name: "getGuestMessages",
  description:
    "Read the guest's own operational messages from the TALA inbox (tala_guest_messages): message, reply, status and timestamps. Use when a guest asks 'do I have any messages?', 'did TALA reply?'. Guest sees only their own; owner/admin may pass a guestName.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = scopeArgs(ctx, args as Record<string, unknown>);
    if (ctx.role !== "owner" && ctx.role !== "admin" && !identityProvided(identity(ctx))) {
      await audit(ctx.db, ctx, "getGuestMessages", false, "no self identity");
      return deny();
    }
    try {
      const rows = await getGuestMessages(ctx.env as never, scope);
      await audit(ctx.db, ctx, "getGuestMessages", true);
      return { success: true, data: rows };
    } catch (e) {
      await audit(ctx.db, ctx, "getGuestMessages", false, String(e));
      return { success: false, error: "Could not read messages." };
    }
  },
};

export const getGuestFolioTool: TallaTool = {
  name: "getGuestFolio",
  description:
    "Read the guest's own bill from tala_folio_lines: itemized charges and payments, total charges, total paid, and balance. Use when a guest asks 'how much do I owe?', 'what is my balance?'. Guest sees only their own; owner/admin may pass a guestName. Links are explicit (related_id) — unlinked lines are reported as unresolved, never guessed.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Owner/admin only: guest name to look up" },
      guestPhone: { type: "string", description: "Owner/admin only: guest phone to look up" },
    },
    required: [],
  },
  execute: async (args, ctx) => {
    const scope = scopeArgs(ctx, args as Record<string, unknown>);
    if (ctx.role !== "owner" && ctx.role !== "admin" && !identityProvided(identity(ctx))) {
      await audit(ctx.db, ctx, "getGuestFolio", false, "no self identity");
      return deny();
    }
    try {
      const f: GuestFolio = await getGuestFolio(ctx.env as never, scope);
      await audit(ctx.db, ctx, "getGuestFolio", true);
      return {
        success: true,
        data: {
          guestName: f.guestName,
          charges: f.lines.filter((l) => l.kind === "charge"),
          payments: f.lines.filter((l) => l.kind === "payment"),
          totalCharges: f.totalCharges,
          totalPaid: f.totalPaid,
          balance: f.balance,
          unresolved: f.unresolved,
        },
      };
    } catch (e) {
      await audit(ctx.db, ctx, "getGuestFolio", false, String(e));
      return { success: false, error: "Could not read folio." };
    }
  },
};

export const writeGuestMessageTool: TallaTool = {
  name: "writeGuestMessage",
  description:
    "Persist an operational message into the guest's TALA inbox (tala_guest_messages) so the Guest Portal can display it. Use for lifecycle updates like 'Tour confirmed', 'Food is ready', 'Request completed', 'Confirmation required'. Owner/TALA only. Writes source=tala_chat.",
  parameters: {
    type: "object",
    properties: {
      guestName: { type: "string", description: "Guest name the message is for" },
      guestPhone: { type: "string", description: "Guest phone the message is for" },
      message: { type: "string", description: "The operational message text" },
      status: { type: "string", description: "Message status (default unread)" },
    },
    required: ["guestName", "guestPhone", "message"],
  },
  execute: async (args, ctx) => {
    const a = args as { guestName?: string; guestPhone?: string; message?: string; status?: string };
    if (!a.guestName || !a.guestPhone || !a.message) {
      await audit(ctx.db, ctx, "writeGuestMessage", false, "missing fields");
      return { success: false, error: "guestName, guestPhone and message are required." };
    }
    try {
      const res = await writeGuestMessage(ctx.env as never, {
        guestName: a.guestName,
        guestPhone: a.guestPhone,
        message: a.message,
        status: a.status,
        source: "tala_chat",
      });
      if (!res.ok) {
        await audit(ctx.db, ctx, "writeGuestMessage", false, res.error);
        return { success: false, error: res.error ?? "Failed to persist message." };
      }
      await audit(ctx.db, ctx, "writeGuestMessage", true);
      return { success: true, id: res.id, data: { message: "Message sent to guest inbox." } };
    } catch (e) {
      await audit(ctx.db, ctx, "writeGuestMessage", false, String(e));
      return { success: false, error: "Could not persist message." };
    }
  },
};
