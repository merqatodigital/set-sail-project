// Guest lifecycle deterministic-contract tests.
// Mirrors bookingTools.test.ts: mocks Supabase fetch + D1 tour catalog.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as guestStateRepo from "../src/db/repos/guestStateRepo.js";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc_key",
} as unknown as import("../src/env.js").Env;

// D1 fake that supports both run() and first().
function fakeDb(row: any = {}): any {
  return {
    prepare: () => ({
      bind: () => ({
        run: async () => ({}),
        first: async () => row,
        all: async () => ({ results: [row] }),
      }),
    }),
  };
}
function makeCtx(role: string, guestName?: string, guestPhone?: string): any {
  return {
    db: fakeDb(),
    env,
    tenantId: "marina_terrace",
    role,
    guestName: guestName ?? null,
    guestPhone: guestPhone ?? null,
    userId: role === "owner" ? "s" : null,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sbJson(rows: any[]) {
  return { ok: true, status: 200, json: async () => rows, text: async () => "" };
}
function sbCreated(rows: any[]) {
  return { ok: true, status: 201, json: async () => rows, text: async () => "" };
}

// Mock the tour catalog (D1) so requestTour gets an authoritative price.
vi.mock("../src/db/repos/toursRepo.js", () => ({
  listActiveTours: async () => [
    { id: "t1", name: "Island Hopping", price: 1500, capacity: 10, active: true } as any,
  ],
}));

async function importLifecycle() {
  return await import("../src/agents/tools/guestLifecycleTools.js");
}

// ---------------------------------------------------------------------------
describe("computeStayPhase (state transitions)", () => {
  const { computeStayPhase } = guestStateRepo;
  it("before_arrival when today < check-in", () => {
    expect(computeStayPhase("2026-09-01", "2026-09-05", "pending", new Date("2026-08-10"))).toBe("before_arrival");
  });
  it("staying when checked_in and within window", () => {
    expect(computeStayPhase("2026-08-09", "2026-08-15", "checked_in", new Date("2026-08-11"))).toBe("staying");
  });
  it("checkout_approaching when checked_in and past check-out date", () => {
    expect(computeStayPhase("2026-08-09", "2026-08-10", "checked_in", new Date("2026-08-11"))).toBe("checkout_approaching");
  });
  it("checked_out when status is checked_out", () => {
    expect(computeStayPhase("2026-08-09", "2026-08-10", "checked_out", new Date("2026-08-11"))).toBe("checked_out");
  });
  it("checked_in for confirmed booking within window", () => {
    expect(computeStayPhase("2026-08-09", "2026-08-15", "confirmed", new Date("2026-08-11"))).toBe("checked_in");
  });
});

// ---------------------------------------------------------------------------
describe("requestTour deterministic contract", () => {
  it("requires tourName/date/guests; reports missing fields", async () => {
    const m = await importLifecycle();
    const res = await m.requestTourTool.execute!({ tourName: "Island Hopping" }, makeCtx("guest", "David"));
    expect(res.success).toBe(false);
    expect(String((res as any).error)).toMatch(/tour name|date|guests/i);
  });

  it("rejects unknown tour (price not found) — never invents a price", async () => {
    vi.doMock("../src/db/repos/toursRepo.js", () => ({
      listActiveTours: async () => [] as any,
    }));
    const m = await importLifecycle();
    const res = await m.requestTourTool.execute!(
      { tourName: "Nonexistent Tour", tourDate: "2026-08-20", guests: 2 },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(false);
    expect(String((res as any).error)).toMatch(/couldn't find/i);
  });

  it("creates ONE pending request with authoritative price + TT reference", async () => {
    const m = await importLifecycle();
    // GET (dedupe SELECT) -> no existing; POST (create) -> created row.
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (typeof url === "string" && url.includes("tala_tour_requests")) {
        if (method === "POST") return sbCreated([{ id: "u1", reference: "TT-20260820-1234" }]);
        return sbJson([]); // SELECT finds nothing
      }
      return sbJson([]);
    });
    const res = await m.requestTourTool.execute!(
      { tourName: "Island Hopping", tourDate: "2026-08-20", guests: 2 },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(true);
    const data = (res as any).data;
    expect(data.reference).toMatch(/^TT-\d{8}-\d{4}$/);
    expect(data.amount).toBe(1500); // authoritative, not guest-supplied
    expect(data.status).toBe("requested");
    const post = fetchMock.mock.calls.find((c: any[]) => (c[1]?.method ?? "GET") === "POST");
    expect(post).toBeTruthy();
    const body = JSON.parse(post![1].body);
    expect(body.amount).toBe(1500);
    expect(body.status).toBe("requested");
    expect(body.guest_name).toBe("David");
  });

  it("duplicate replay returns existing reference, no second write", async () => {
    const m = await importLifecycle();
    // SELECT finds an existing pending row; no POST should be issued.
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (typeof url === "string" && url.includes("tala_tour_requests")) {
        if (method === "POST") return sbCreated([{ id: "u2", reference: "TT-20260820-9999" }]);
        return sbJson([{ id: "u1", reference: "TT-20260820-9999", status: "requested" }]);
      }
      return sbJson([]);
    });
    const res = await m.requestTourTool.execute!(
      { tourName: "Island Hopping", tourDate: "2026-08-20", guests: 2 },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(true);
    const data = (res as any).data;
    expect(data.duplicate).toBe(true);
    expect(data.reference).toBe("TT-20260820-9999");
    const posts = fetchMock.mock.calls.filter((c: any[]) => (c[1]?.method ?? "GET") === "POST");
    expect(posts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("requestRental deterministic contract", () => {
  it("creates ONE pending rental with authoritative rate + MR reference", async () => {
    const m = await importLifecycle();
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (typeof url === "string" && url.includes("motorbikes")) return sbJson([{ name: "Honda Click", daily_rate: 500 }]);
      if (typeof url === "string" && url.includes("tala_rental_requests")) {
        if (method === "POST") return sbCreated([{ id: "r1", reference: "MR-20260820-4321" }]);
        return sbJson([]);
      }
      return sbJson([]);
    });
    const res = await m.requestRentalTool.execute!(
      { bikeName: "Honda Click", startDate: "2026-08-20", endDate: "2026-08-22" },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(true);
    const data = (res as any).data;
    expect(data.reference).toMatch(/^MR-\d{8}-\d{4}$/);
    expect(data.dailyRate).toBe(500);
    expect(data.status).toBe("requested");
  });

  it("rejects unknown bike (rate not found)", async () => {
    const m = await importLifecycle();
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("motorbikes")) return sbJson([]);
      return sbJson([]);
    });
    const res = await m.requestRentalTool.execute!(
      { bikeName: "Ghost Bike", startDate: "2026-08-20", endDate: "2026-08-22" },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(false);
    expect(String((res as any).error)).toMatch(/couldn't find/i);
  });
});

// ---------------------------------------------------------------------------
describe("requestHousekeeping deterministic contract", () => {
  it("requires room", async () => {
    const m = await importLifecycle();
    const res = await m.requestHousekeepingTool.execute!({}, makeCtx("guest", "David"));
    expect(res.success).toBe(false);
    expect(String((res as any).error)).toMatch(/room/i);
  });
  it("creates pending with HK reference", async () => {
    const m = await importLifecycle();
    const res = await m.requestHousekeepingTool.execute!(
      { room: "Cabana 3", taskType: "cleaning", priority: "normal" },
      makeCtx("guest", "David", "+639999"),
    );
    expect(res.success).toBe(true);
    expect((res as any).data.reference).toMatch(/^HK-\d{8}-\d{4}$/);
    expect((res as any).data.status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
describe("owner-only guards", () => {
  it("guest cannot recordPayment", async () => {
    const m = await importLifecycle();
    const res = await m.recordPaymentTool.execute!(
      { guestName: "David", amount: 100, method: "cash" },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(false);
    expect(String((res as any).error)).toMatch(/staff/i);
  });
  it("guest cannot checkOutGuest", async () => {
    const m = await importLifecycle();
    const res = await m.checkOutGuestTool.execute!(
      { guestName: "David", roomType: "Superior Room UNO", checkIn: "2026-08-10" },
      makeCtx("guest", "David"),
    );
    expect(res.success).toBe(false);
    expect(String((res as any).error)).toMatch(/staff/i);
  });
  it("owner recordPayment writes a payment folio line", async () => {
    const m = await importLifecycle();
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (typeof url === "string" && url.includes("tala_folio_lines") && (init?.method ?? "GET") === "POST")
        return sbCreated([{ id: "p1", reference: "PAY-20260810-1111" }]);
      return sbJson([]);
    });
    const res = await m.recordPaymentTool.execute!(
      { guestName: "David", amount: 100, method: "gcash" },
      makeCtx("owner", "David"),
    );
    expect(res.success).toBe(true);
    expect((res as any).data.reference).toMatch(/^PAY-/);
    const post = fetchMock.mock.calls.find((c: any[]) => (c[1]?.method ?? "GET") === "POST");
    const body = JSON.parse(post![1].body);
    expect(body.kind).toBe("payment");
    expect(body.amount).toBe(100);
  });
});

// ---------------------------------------------------------------------------
describe("getGuestStayState composition (via mocked Supabase fetch)", () => {
  it("composes authoritative sources into one object with phase + outstanding", async () => {
    // Each table's GET returns its row; housekeeping (D1 guest_requests) returns [].
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/bookings")) return sbJson([{ id: "b1", guest_name: "David", room_type: "Superior", guests: 2, check_in: "2026-08-09", check_out: "2026-08-12", status: "confirmed", amount: 0, paid_amount: 0, notes: "" }]);
      if (u.includes("tala_tour_requests")) return sbJson([{ id: "t1", guest_name: "David", tour_name: "Island Hopping", tour_date: "2026-08-20", guests: 2, amount: 1500, status: "requested", notes: "", source: "", created_at: "" }]);
      if (u.includes("tala_rental_requests")) return sbJson([]);
      if (u.includes("tala_food_orders")) return sbJson([]);
      if (u.includes("tala_guest_messages")) return sbJson([]);
      if (u.includes("tala_folio_lines")) return sbJson([]);
      return sbJson([]);
    });
    const state = await guestStateRepo.getGuestStayState(env, fakeDb(), "marina_terrace", { name: "David" });
    expect(state.booking).toHaveLength(1);
    expect(state.phase).toMatch(/^(before_arrival|checked_in|staying|checkout_approaching|checked_out)$/);
    expect(state.tours).toHaveLength(1);
    expect(state.outstanding).toContain("Tour Island Hopping (requested)");
    expect(state.folio.balance).toBe(0);
  });
});
