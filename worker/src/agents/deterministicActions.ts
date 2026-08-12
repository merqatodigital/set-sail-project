// Deterministic action executor — runs BEFORE the LLM when a guest message is
// an unambiguous, self-contained request. This removes reliance on free-model
// "personality" for completing clear workflows (food orders, reception messages)
// so the write always happens. If the intent is ambiguous, returns null and the
// normal LLM loop handles it.
//
// Security: food/message writes reuse the session-verified guestName/guestPhone
// from TallaAgent state — never a raw name supplied in the message text.

import type { ToolContext } from "./types.js";
import type { ChatResponse } from "./provider.js";
import { createFoodOrder } from "../db/repos/foodOrderRepo.js";
import { listMenuItems } from "../db/repos/menuRepo.js";
import { writeGuestMessage, getDayPassPrice, findPendingDayPass, createDayPassRequest } from "../db/repos/guestStateRepo.js";

export interface DeterministicResult {
  response: ChatResponse;
  // If a food quote was produced but not yet written (model quoted instead of
  // calling the tool), stash the resolved items so a later "yes/confirm" turn
  // can complete the write deterministically.
  pendingFoodOrder?: { menuItemId: string; quantity: number; specialInstructions?: string }[] | null;
}

const AFFIRMATIVE = /^(yes|yeah|yep|yup|confirm|confirmed|place it|go ahead|do it|sure|ok|okay|affirmative)\b/i;

function isAffirmative(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (AFFIRMATIVE.test(t)) return true;
  // short "yes." / "yes!" etc.
  return /^y[e]?s[.!]?$/.test(t);
}

export async function tryDeterministicActions(
  userMessage: string,
  toolCtx: ToolContext,
  pendingFoodOrder: { menuItemId: string; quantity: number; specialInstructions?: string }[] | null,
): Promise<DeterministicResult | null> {
  const text = userMessage.trim();

  // 0) Workspace Day Pass — deterministic product booking (no LLM dependency).
  // The Lovable Day Pass form sends a structured natural-language request;
  // resolve it server-side and write exactly ONE pending operational record.
  if (isDayPassRequest(text)) {
    const res = await executeDayPass(toolCtx, text);
    if (res) return { response: res };
  }

  // 1) Confirm a previously-quoted food order ("yes", "place it", ...)
  if (pendingFoodOrder && pendingFoodOrder.length > 0 && isAffirmative(text)) {
    const res = await executeFoodOrder(toolCtx, pendingFoodOrder);
    return { response: res, pendingFoodOrder: null };
  }

  // 2) Reception message — explicit hand-off to front desk.
  const msg = detectReceptionMessage(text);
  if (msg && (toolCtx.guestName || toolCtx.role === "owner" || toolCtx.role === "admin")) {
    const written = await writeGuestMessage(toolCtx.env, {
      guestName: toolCtx.guestName ?? "Guest",
      guestPhone: toolCtx.guestPhone ?? "",
      message: msg,
      status: "unread",
      source: "tala_chat",
    });
    if (written.ok) {
      return {
        response: {
          content: `Noted — I've left a message for reception: "${msg}". The front desk will see it.`,
          toolCalls: [],
          finishReason: "stop",
          model: "deterministic",
        },
      };
    }
    return {
      response: {
        content: `I tried to leave that message for reception but it didn't save (${written.error}). Please try again or ask the front desk directly.`,
        toolCalls: [],
        finishReason: "stop",
        model: "deterministic",
      },
    };
  }

  // 3) Direct food order intent ("order one Bottled Water and a Mango Shake").
  const items = await resolveFoodItems(text, toolCtx);
  if (items && items.length > 0) {
    const res = await executeFoodOrder(toolCtx, items);
    // If the order actually wrote, return it. If it failed validation, let the
    // LLM explain. If it was only a partial match we return null to defer.
    if (res.model === "deterministic") return { response: res, pendingFoodOrder: null };
    return { response: res }; // fallthrough-style error surfaced to guest
  }

  return null;
}

// ---------------------------------------------------------------------------
// WORKSPACE DAY PASS — deterministic handler (no LLM, no free-model dependency).
// The Lovable form sends a structured message; we parse the required fields,
// read the authoritative Admin price, dedupe, and write ONE pending record.
// Returns null only when the message isn't a Day Pass request or is missing
// required fields (so the LLM can ask for the missing pieces).
// ---------------------------------------------------------------------------
export function isDayPassRequest(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("workspace day pass") && (t.includes("book") || t.includes("pass on"));
}

interface ParsedDayPass {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  day: string;
  guests: number;
  arrivalTime: string;
  notes: string;
}

function parseDayPass(text: string): ParsedDayPass | null {
  const name = text.match(/my name is\s+([^.]+)/i);
  const email = text.match(/my email is\s+([^.]+(?:\.[^.\s]+)*)/i);
  const phone = text.match(/my whatsapp\/mobile number is\s+([^.]+)/i);
  const day = text.match(/(?:on|check-in)\s+(\d{4}-\d{2}-\d{2})/i);
  const guests = text.match(/for\s+(\d+)\s+guest/i);
  const notes = text.match(/additional requests?:\s*([^.]*)/i);
  const arrival = notes?.[1]?.match(/arrival around\s+([^.·]+)/i);

  if (!name || !email || !phone || !day || !guests) return null;
  const clean = (s: string) => s.replace(/[.!]?\s*$/, "").trim();
  return {
    guestName: clean(name[1]),
    guestEmail: clean(email[1]),
    guestPhone: clean(phone[1]),
    day: day[1],
    guests: Math.max(1, parseInt(guests[1], 10) || 1),
    arrivalTime: arrival ? clean(arrival[1]) : "",
    notes: notes ? clean(notes[1]) : "",
  };
}

async function executeDayPass(
  toolCtx: ToolContext,
  text: string,
): Promise<ChatResponse | null> {
  const parsed = parseDayPass(text);
  if (!parsed) return null; // missing required fields -> let LLM ask

  try {
    // Authoritative price from Admin Financial settings (cms_data). Never trust
    // a guest-supplied amount; never hardcode.
    // Authoritative price when configured. When it is not configured yet we
    // still SAVE the request (amount 0 = rate confirmed by reception) instead
    // of dropping a complete guest submission on the floor.
    const unitPrice = await getDayPassPrice(toolCtx.env, toolCtx.tenantId || "");

    // Dedupe: same guest/day/guests already pending -> return existing ref.
    const dup = await findPendingDayPass(toolCtx.env, {
      guestName: parsed.guestName,
      day: parsed.day,
      guests: parsed.guests,
    }).catch(() => null);
    if (dup && dup.reference) {
      return {
        content: `You already have a pending Workspace Day Pass request (reference ${dup.reference}). We'll confirm shortly.`,
        toolCalls: [],
        finishReason: "stop",
        model: "deterministic",
      };
    }

    const amount = unitPrice === null ? 0 : unitPrice * parsed.guests;
    const res = await createDayPassRequest(toolCtx.env, {
      guestName: parsed.guestName,
      guestEmail: parsed.guestEmail,
      guestPhone: parsed.guestPhone,
      day: parsed.day,
      guests: parsed.guests,
      arrivalTime: parsed.arrivalTime,
      notes: parsed.notes,
      amount,
      reference: "",
    });
    const arrivalNote = parsed.arrivalTime ? ` Arriving around ${parsed.arrivalTime}.` : "";
    const priceNote =
      unitPrice === null
        ? "Reception will confirm today's rate with you."
        : `₱${amount} total (₱${unitPrice}/guest).`;
    return {
      content: `Workspace Day Pass request received (pending). Reference ${res.reference}. ${parsed.guests} guest${parsed.guests > 1 ? "s" : ""} on ${parsed.day} — ${priceNote}${arrivalNote} We'll confirm shortly.`,
      toolCalls: [],
      finishReason: "stop",
      model: "deterministic",
    };
  } catch (err) {
    return {
      content: `I couldn't save your Day Pass request just now: ${(err as Error).message}`,
      toolCalls: [],
      finishReason: "stop",
      model: "deterministic",
    };
  }
}

async function executeFoodOrder(
  toolCtx: ToolContext,
  items: { menuItemId: string; quantity: number; specialInstructions?: string }[],
): Promise<ChatResponse> {
  try {
    const menuItems = await listMenuItems(toolCtx.db, toolCtx.tenantId, { activeOnly: true });
    const order = await createFoodOrder(
      toolCtx.db,
      toolCtx.tenantId,
      {
        guestName: toolCtx.guestName ?? "Guest",
        guestPhone: toolCtx.guestPhone ?? "",
        notes: "",
        items,
      },
      menuItems,
    );
    const itemSummary = order.items.map((i) => `${i.quantity}x ${i.name} (₱${i.price} each)`);
    return {
      content: `Order ${order.reference} placed. Total: ₱${order.total}. ${itemSummary.join(", ")}.`,
      toolCalls: [],
      finishReason: "stop",
      model: "deterministic",
    };
  } catch (err) {
    return {
      content: `I couldn't place that food order: ${(err as Error).message}`,
      toolCalls: [],
      finishReason: "stop",
      model: "deterministic",
    };
  }
}

// Resolve menu items mentioned in free text. Returns null if NO food intent is
// present (so we don't hijack unrelated messages). Returns a (possibly empty)
// list of resolved items when intent IS present.
export async function resolveFoodItems(
  text: string,
  toolCtx: ToolContext,
): Promise<{ menuItemId: string; quantity: number; specialInstructions?: string }[] | null> {
  const lower = text.toLowerCase();
  const menuItems = await listMenuItems(toolCtx.db, toolCtx.tenantId, { activeOnly: true });

  const resolved: { menuItemId: string; quantity: number; specialInstructions?: string }[] = [];
  for (const item of menuItems) {
    const name = item.name.toLowerCase();
    const head = name.split(" ")[0];
    let matched = false;
    let qty = 1;
    if (lower.includes(name)) {
      matched = true;
    } else if (head.length >= 4 && lower.includes(head)) {
      matched = true;
    }
    if (matched) {
      const q = text.match(
        new RegExp(`(\\d+)\\s*(?:x\\s*)?${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
      );
      if (q) qty = parseInt(q[1], 10);
      resolved.push({ menuItemId: item.id, quantity: qty, specialInstructions: "" });
    }
  }

  // No menu item mentioned at all -> not a food request (don't hijack).
  if (resolved.length === 0) {
    const hasFoodWord = /(food|eat|drink|order|menu|snack|meal|beverage|water|coke|cola|shake|coffee|juice|rice|beer|tea|sandwich|burger|pizza)/.test(lower);
    return hasFoodWord ? [] : null;
  }

  // De-duplicate by menuItemId, max quantity.
  const byId = new Map<string, number>();
  for (const r of resolved) byId.set(r.menuItemId, Math.max(byId.get(r.menuItemId) ?? 0, r.quantity));
  return Array.from(byId.entries()).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

export function detectReceptionMessage(text: string): string | null {
  const patterns = [
    /tell\s+reception\s+(?:that\s+)?(.+)/i,
    /message\s+(?:to\s+)?reception[:\s]+(.+)/i,
    /send\s+(?:a\s+)?message\s+to\s+reception[:\s]+(.+)/i,
    /ask\s+reception\s+(?:to\s+)?(.+)/i,
    /let\s+reception\s+know\s+(?:that\s+)?(.+)/i,
    /inform\s+reception\s+(?:that\s+)?(.+)/i,
    /reception\s*[:\-]\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].trim().length > 2) return m[1].trim().replace(/[.!]?$/, "");
  }
  return null;
}

// Detect whether an LLM-produced assistant message was a food QUOTE without a
// completed order (so the next affirmative turn can finalize it).
export function isFoodQuoteWithoutOrder(assistantContent: string): boolean {
  const c = assistantContent.toLowerCase();
  const hasTotal = /total.*₱|₱\s*\d|php\s*\d/.test(c) && /(bottled|water|shake|coke|cola|coffee|juice|rice|meal|menu|snack|beer|tea|sandwich|burger|pizza|mango)/.test(c);
  const noOrderRef = !/order\s+(tt|mt|fk|fo|fd|ff)-/i.test(c) && !/placed\.|order\s+#/i.test(c);
  return hasTotal && noOrderRef;
}
