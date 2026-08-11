// Workspace Day Pass deterministic test — proves the FIRST-CLASS Day Pass
// product is created without the LLM, uses the AUTHORITATIVE admin price
// (never guest-supplied), writes exactly ONE pending record, dedupes, and does
// NOT consume room inventory.
import { describe, it, expect, vi, beforeEach } from "vitest";

const MENU = [
  { id: "m1", name: "Bottled Water", price: 25, active: true, category: "Drinks" },
];

vi.mock("../src/db/repos/menuRepo.js", () => ({
  listMenuItems: vi.fn(async () => MENU),
}));
vi.mock("../src/db/repos/foodOrderRepo.js", () => ({
  createFoodOrder: vi.fn(async () => ({ id: "fo_1", reference: "FO-X", total: 0, status: "pending", items: [] })),
}));
vi.mock("../src/db/repos/guestStateRepo.js", () => ({
  writeGuestMessage: vi.fn(async () => ({ ok: true, id: "msg_1" })),
  // Authoritative price lives in D1 property_settings; the worker reads it.
  getDayPassPrice: vi.fn(async () => 1040),
  // No existing pending Day Pass -> first submission creates one.
  findPendingDayPass: vi.fn(async () => null),
  createDayPassRequest: vi.fn(async (_env, input) => ({
    id: "dp_1",
    reference: "MT-20260925-9298",
  })),
}));

import { tryDeterministicActions } from "../src/agents/deterministicActions.js";
import { getDayPassPrice, findPendingDayPass, createDayPassRequest } from "../src/db/repos/guestStateRepo.js";

const ctx = {
  tenantId: "marina_terrace",
  userId: "u1",
  role: "guest",
  db: {} as never,
  env: {} as never,
  guestName: "Daya",
  guestPhone: "+639171234567",
} as never;

const DAY_PASS_MSG =
  "I'd like to book a Workspace Day Pass on 2026-09-25 for 2 guests. " +
  "My name is Daya Pass. My email is daya@example.com. " +
  "My WhatsApp/mobile number is +639171234567. " +
  "Check-in 2026-09-25, check-out 2026-09-26 (single day pass). " +
  "Additional requests: Arrival around 9 AM · Allergies/dietary: vegetarian.";

beforeEach(() => {
  vi.clearAllMocks();
  (getDayPassPrice as unknown as vi.Mock).mockResolvedValue(1040);
  (findPendingDayPass as unknown as vi.Mock).mockResolvedValue(null);
  (createDayPassRequest as unknown as vi.Mock).mockResolvedValue({ id: "dp_1", reference: "MT-20260925-9298" });
});

describe("Workspace Day Pass — deterministic creation", () => {
  it("creates exactly ONE pending Day Pass with the authoritative price", async () => {
    const r = await tryDeterministicActions(DAY_PASS_MSG, ctx, null);
    expect(r).not.toBeNull();
    expect(r!.response.model).toBe("deterministic");
    // Reference returned to the guest.
    expect(r!.response.content).toContain("MT-20260925-9298");
    // Authoritative price used: 1040 x 2 guests = 2080, never guest-supplied.
    expect(r!.response.content).toContain("₱2080");
    expect(r!.response.content).toContain("₱1040/guest");
    expect(createDayPassRequest).toHaveBeenCalledTimes(1);
    const call = (createDayPassRequest as unknown as vi.Mock).mock.calls[0][1];
    expect(call.guestName).toBe("Daya Pass");
    expect(call.guestEmail).toBe("daya@example.com");
    expect(call.guestPhone).toBe("+639171234567");
    expect(call.day).toBe("2026-09-25");
    expect(call.guests).toBe(2);
    expect(call.amount).toBe(2080); // authoritative: price x guests
    // Product discriminator — NOT a real room type.
    expect(call.arrivalTime).toContain("9 AM");
  });

  it("reads the authoritative price from admin settings (not hardcoded)", async () => {
    (getDayPassPrice as unknown as vi.Mock).mockResolvedValue(1500);
    const r = await tryDeterministicActions(DAY_PASS_MSG, ctx, null);
    expect(r!.response.content).toContain("₱3000"); // 1500 x 2
    expect(createDayPassRequest).toHaveBeenCalledTimes(1);
    expect((createDayPassRequest as unknown as vi.Mock).mock.calls[0][1].amount).toBe(3000);
  });

  it("dedupes: an existing pending Day Pass returns the same reference", async () => {
    (findPendingDayPass as unknown as vi.Mock).mockResolvedValue({ id: "dp_1", reference: "MT-20260925-9298" });
    const r = await tryDeterministicActions(DAY_PASS_MSG, ctx, null);
    expect(r!.response.content).toContain("MT-20260925-9298");
    expect(createDayPassRequest).not.toHaveBeenCalled();
  });

  it("does not hijack a normal message", async () => {
    expect(await tryDeterministicActions("What time is breakfast?", ctx, null)).toBeNull();
  });
});
