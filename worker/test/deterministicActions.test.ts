// Deterministic action executor tests — proves food orders and reception
// messages complete WITHOUT relying on model personality.
import { describe, it, expect, vi, beforeEach } from "vitest";

const MENU = [
  { id: "m1", name: "Bottled Water", price: 25, active: true, category: "Drinks" },
  { id: "m2", name: "Mango Shake", price: 90, active: true, category: "Drinks" },
  { id: "m3", name: "Corned Beef with Eggs", price: 350, active: true, category: "Meals" },
];

vi.mock("../src/db/repos/menuRepo.js", () => ({
  listMenuItems: vi.fn(async () => MENU),
}));
vi.mock("../src/db/repos/foodOrderRepo.js", () => ({
  createFoodOrder: vi.fn(async (_db, _tenant, _input, _menu) => ({
    id: "fo_1",
    reference: "FO-20260811-0001",
    total: 115,
    status: "pending",
    items: [
      { name: "Bottled Water", price: 25, quantity: 1 },
      { name: "Mango Shake", price: 90, quantity: 1 },
    ],
  })),
}));
vi.mock("../src/db/repos/guestStateRepo.js", () => ({
  writeGuestMessage: vi.fn(async () => ({ ok: true, id: "msg_1" })),
}));

import {
  tryDeterministicActions,
  resolveFoodItems,
  detectReceptionMessage,
  isFoodQuoteWithoutOrder,
} from "../src/agents/deterministicActions.js";
import { listMenuItems } from "../src/db/repos/menuRepo.js";
import { createFoodOrder } from "../src/db/repos/foodOrderRepo.js";
import { writeGuestMessage } from "../src/db/repos/guestStateRepo.js";

const ctx = {
  tenantId: "marina_terrace",
  userId: "u1",
  role: "guest",
  db: {} as never,
  env: {} as never,
  guestName: "Liza",
  guestPhone: "+639171555666",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  (listMenuItems as unknown as vi.Mock).mockResolvedValue(MENU);
});

describe("resolveFoodItems", () => {
  it("resolves exact menu names from free text", async () => {
    const items = await resolveFoodItems("Order one Bottled Water and one Mango Shake", ctx);
    expect(items).not.toBeNull();
    const ids = (items ?? []).map((i) => i.menuItemId).sort();
    expect(ids).toEqual(["m1", "m2"]);
  });

  it("returns null for unrelated messages", async () => {
    expect(await resolveFoodItems("What time is checkout?", ctx)).toBeNull();
  });

  it("parses quantities", async () => {
    const items = await resolveFoodItems("2 Bottled Water", ctx);
    const bw = (items ?? []).find((i) => i.menuItemId === "m1");
    expect(bw?.quantity).toBe(2);
  });
});

describe("detectReceptionMessage", () => {
  it("extracts the message to reception", () => {
    expect(detectReceptionMessage("Tell reception that we need late checkout")).toBe(
      "we need late checkout",
    );
    expect(detectReceptionMessage("Send a message to reception: please add pillows")).toBe(
      "please add pillows",
    );
  });
  it("returns null when no reception intent", () => {
    expect(detectReceptionMessage("How is the weather?")).toBeNull();
  });
});

describe("isFoodQuoteWithoutOrder", () => {
  it("detects a quote without a placed order reference", () => {
    expect(isFoodQuoteWithoutOrder("That's 1 Bottled Water (₱25) and 1 Mango Shake (₱90). Total ₱115. Shall I place it?")).toBe(true);
  });
  it("does not flag an actual order confirmation", () => {
    expect(isFoodQuoteWithoutOrder("Order FO-20260811-0001 placed. Total: ₱115.")).toBe(false);
  });
});

describe("tryDeterministicActions — food", () => {
  it("places a food order directly from a clear request", async () => {
    const r = await tryDeterministicActions("Order one Bottled Water and one Mango Shake", ctx, null);
    expect(r).not.toBeNull();
    expect(r!.response.model).toBe("deterministic");
    expect(r!.response.content).toContain("FO-20260811-0001");
    expect(createFoodOrder).toHaveBeenCalledTimes(1);
    // used authoritative session identity, not a name from the text
    const call = (createFoodOrder as unknown as vi.Mock).mock.calls[0][2];
    expect(call.guestName).toBe("Liza");
  });

  it("completes a quoted order on affirmative + pendingFoodOrder", async () => {
    const pending = [{ menuItemId: "m1", quantity: 1 }];
    const r = await tryDeterministicActions("yes place it", ctx, pending);
    expect(r).not.toBeNull();
    expect(r!.response.content).toContain("FO-20260811-0001");
    expect(createFoodOrder).toHaveBeenCalledTimes(1);
    expect(r!.pendingFoodOrder).toBeNull();
  });

  it("does not hijack an unrelated message", async () => {
    expect(await tryDeterministicActions("What is my booking status?", ctx, null)).toBeNull();
  });
});

describe("tryDeterministicActions — reception message", () => {
  it("writes a reception message reusing session identity", async () => {
    const r = await tryDeterministicActions("Tell reception we need extra pillows", ctx, null);
    expect(r).not.toBeNull();
    expect(writeGuestMessage).toHaveBeenCalledTimes(1);
    const call = (writeGuestMessage as unknown as vi.Mock).mock.calls[0][1];
    expect(call.guestName).toBe("Liza");
    expect(call.message).toContain("extra pillows");
    expect(r!.response.content).toContain("reception");
  });
});
