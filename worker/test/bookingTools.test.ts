// requestRoomBooking deterministic contract tests. Mocks Supabase fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc_key",
} as unknown as import("../src/env.js").Env;

function fakeDb(): any {
  return { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) };
}
function makeCtx(role: string, guestName?: string): any {
  return {
    db: fakeDb(),
    env,
    tenantId: "marina_terrace",
    role,
    guestName: guestName ?? null,
    userId: role === "owner" ? "s" : null,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function sbJson(rows: any[]) { return { ok: true, status: 200, json: async () => rows, text: async () => "" }; }
async function importTool() { return (await import("../src/agents/tools/bookingTools.js")).requestRoomBookingTool; }

const full = {
  guestName: "David",
  guestEmail: "david@example.com",
  guestPhone: "+639171234567",
  roomType: "Superior Room UNO",
  checkIn: "2026-08-10",
  checkOut: "2026-08-12",
  guests: 2,
};

describe("requestRoomBooking required-field enforcement", () => {
  it("refuses when name/email/phone missing (returns requiresInput + missingFields, no write)", async () => {
    const t = await importTool();
    const res = await t.execute!({ roomType: "Superior Room UNO", checkIn: "2026-08-10", checkOut: "2026-08-12", guests: 2 }, makeCtx("guest"));
    expect(res.success).toBe(false);
    expect((res as any).requiresInput).toBe(true);
    expect((res as any).missingFields.sort()).toEqual(["guestEmail", "guestName", "guestPhone"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when dates missing", async () => {
    const t = await importTool();
    const res = await t.execute!({ ...full, checkIn: "", checkOut: "" }, makeCtx("guest"));
    expect(res.success).toBe(false);
    expect((res as any).missingFields).toContain("checkIn");
  });

  it("refuses invalid date range", async () => {
    const t = await importTool();
    const res = await t.execute!({ ...full, checkIn: "2026-08-12", checkOut: "2026-08-10" }, makeCtx("guest"));
    expect(res.success).toBe(false);
    expect((res as any).error).toMatch(/date range/i);
  });

  it("refuses guests < 1", async () => {
    const t = await importTool();
    const res = await t.execute!({ ...full, guests: 0 }, makeCtx("guest"));
    expect(res.success).toBe(false);
    expect((res as any).missingFields).toContain("guests");
  });
});

describe("requestRoomBooking create + reference", () => {
  it("creates exactly one pending row with short MT- reference (no raw UUID shown)", async () => {
    fetchMock.mockResolvedValueOnce(sbJson([])); // dedupe: no existing
    fetchMock.mockResolvedValueOnce(sbJson([{ id: "uuid-123", reference: "MT-20260810-4821" }])); // create
    const t = await importTool();
    const res = await t.execute!({ ...full }, makeCtx("guest"));
    expect(res.success).toBe(true);
    expect((res as any).reference).toMatch(/^MT-\d{8}-\d{4}$/);
    expect((res as any).status).toBe("pending");
    expect((res as any).message).not.toContain("uuid-123");
    // POST body must include contact + reference
    const post = fetchMock.mock.calls.find((c: any) => c[1]?.method === "POST")!;
    const body = JSON.parse(post[1].body);
    expect(body.guest_email).toBe("david@example.com");
    expect(body.guest_phone).toBe("+639171234567");
    expect(body.reference).toMatch(/^MT-/);
    expect(body.status).toBe("pending");
  });

  it("reuses session guestName when arg omitted (conversation memory)", async () => {
    fetchMock.mockResolvedValueOnce(sbJson([])); // dedupe: no existing
    fetchMock.mockResolvedValueOnce(sbJson([{ id: "uuid-9", reference: "MT-20260810-9999" }])); // create
    const t = await importTool();
    const res = await t.execute!({ ...full, guestName: undefined } as any, makeCtx("guest", "David"));
    expect(res.success).toBe(true);
    const post = fetchMock.mock.calls.find((c: any) => c[1]?.method === "POST")!;
    const body = JSON.parse(post[1].body);
    expect(body.guest_name).toBe("David");
  });
});

describe("requestRoomBooking duplicate protection", () => {
  it("returns existing pending reference instead of creating a new row", async () => {
    // findPendingBooking returns an existing row
    fetchMock.mockResolvedValueOnce(sbJson([{ id: "existing", reference: "MT-20260810-1111", guest_name: "David", room_type: "Superior Room UNO", check_in: "2026-08-10", check_out: "2026-08-12", guests: 2, status: "pending" }]));
    const t = await importTool();
    const res = await t.execute!({ ...full }, makeCtx("guest"));
    expect(res.success).toBe(true);
    expect((res as any).duplicate).toBe(true);
    expect((res as any).reference).toBe("MT-20260810-1111");
    // No POST (create) call happened — only the SELECT for dedupe
    expect(fetchMock.mock.calls.some((c: any) => c[1]?.method === "POST")).toBe(false);
  });

  it("recovers from dedupe read failure and proceeds to create", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => [], text: async () => "err" });
    fetchMock.mockResolvedValueOnce(sbJson([{ id: "uuid-x", reference: "MT-20260810-2222" }]));
    const t = await importTool();
    const res = await t.execute!({ ...full }, makeCtx("guest"));
    expect(res.success).toBe(true);
    expect((res as any).reference).toMatch(/^MT-/);
  });
});
