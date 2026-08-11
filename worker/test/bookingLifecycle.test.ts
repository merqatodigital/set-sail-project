// Booking lifecycle architecture test — proves the request -> bookings
// promotion, idempotent confirmation, the zero-row false-success guard on
// check-in/out, and coherent pending-request readback in getGuestStayState.
// Supabase REST is mocked by reassigning the global `fetch` (works under both
// `bun test` and `vitest run` — no vitest-only stub APIs are used).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  confirmBookingRequest,
  checkInGuest,
  getGuestStayState,
} from "../src/db/repos/guestStateRepo.js";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc_key",
} as unknown as import("../src/env.js").Env;

let savedFetch: any;
let fetchMock: ((...args: any[]) => Promise<any>) | null = null;
const calls: any[] = [];

function decode(u: any): string {
  return decodeURIComponent(String(u));
}
function methodOf(args: any[]): string {
  return String((args[1]?.method ?? "GET")).toUpperCase();
}

function pendingRequestRow() {
  return {
    id: "uuid-1",
    reference: "MT-20260922-0001",
    guest_name: "Eli",
    guest_email: "eli@example.com",
    guest_phone: "+639171111222",
    room_type: "Superior Room UNO",
    check_in: "2026-09-22",
    check_out: "2026-09-24",
    guests: 2,
    amount: 5000,
    status: "pending",
  };
}

beforeEach(() => {
  savedFetch = (globalThis as any).fetch;
  calls.length = 0;
  fetchMock = async (...args: any[]) => {
    calls.push(args);
    const url = decode(args[0]);
    const method = methodOf(args);
    if (url.includes("/rest/v1/tala_booking_requests") && method === "GET") {
      return { ok: true, json: async () => [pendingRequestRow()], status: 200, text: async () => "" };
    }
    if (url.includes("/rest/v1/bookings") && method === "GET") {
      return { ok: true, json: async () => [], status: 200, text: async () => "" };
    }
    if (url.includes("/rest/v1/bookings") && method === "POST") {
      return { ok: true, json: async () => [{ id: "uuid-1" }], status: 201, text: async () => "" };
    }
    if (url.includes("/rest/v1/tala_booking_requests") && method === "PATCH") {
      return { ok: true, json: async () => [], status: 200, text: async () => "" };
    }
    if (url.includes("/rest/v1/bookings") && method === "PATCH") {
      return { ok: true, json: async () => [], status: 200, text: async () => "" };
    }
    return { ok: true, json: async () => [], status: 200, text: async () => "" };
  };
  (globalThis as any).fetch = fetchMock;
});
afterEach(() => {
  (globalThis as any).fetch = savedFetch;
  fetchMock = null;
});

describe("booking lifecycle — request -> bookings promotion", () => {
  it("confirms a pending request and promotes exactly ONE bookings row with same reference", async () => {
    const r = await confirmBookingRequest(env, { reference: "MT-20260922-0001" });
    expect(r.ok).toBe(true);
    expect(r.reference).toBe("MT-20260922-0001");
    expect(r.bookingId).toBe("uuid-1");

    const posts = calls.filter(
      (c) => decode(c[0]).includes("/rest/v1/bookings") && methodOf(c) === "POST",
    );
    expect(posts.length).toBe(1); // exactly one operational booking created
    const body = JSON.parse(posts[0][1].body as string);
    expect(body.reference).toBe("MT-20260922-0001");
    expect(body.room_type).toBe("Superior Room UNO");
    expect(body.guest_name).toBe("Eli");
    expect(body.status).toBe("confirmed");
    expect(body.amount).toBe(5000); // authoritative from request, not guest-supplied
  });

  it("is idempotent — confirming twice does NOT create a second bookings row", async () => {
    let firstConfirm = true;
    (globalThis as any).fetch = async (...args: any[]) => {
      calls.push(args);
      const url = decode(args[0]);
      const method = methodOf(args);
      if (url.includes("/rest/v1/tala_booking_requests") && method === "GET") {
        return { ok: true, json: async () => [pendingRequestRow()], status: 200, text: async () => "" };
      }
      if (url.includes("/rest/v1/bookings") && method === "GET") {
        if (firstConfirm) {
          firstConfirm = false;
          return { ok: true, json: async () => [], status: 200, text: async () => "" };
        }
        return { ok: true, json: async () => [{ id: "uuid-1", reference: "MT-20260922-0001" }], status: 200, text: async () => "" };
      }
      if (url.includes("/rest/v1/bookings") && method === "POST") {
        return { ok: true, json: async () => [{ id: "uuid-1" }], status: 201, text: async () => "" };
      }
      if (url.includes("/rest/v1/tala_booking_requests") && method === "PATCH") {
        return { ok: true, json: async () => [], status: 200, text: async () => "" };
      }
      return { ok: true, json: async () => [], status: 200, text: async () => "" };
    };

    const r1 = await confirmBookingRequest(env, { reference: "MT-20260922-0001" });
    expect(r1.ok).toBe(true);
    const r2 = await confirmBookingRequest(env, { reference: "MT-20260922-0001" });
    expect(r2.ok).toBe(true);

    const posts = calls.filter(
      (c) => decode(c[0]).includes("/rest/v1/bookings") && methodOf(c) === "POST",
    );
    expect(posts.length).toBe(1); // still exactly one, despite two confirms
  });
});

describe("booking lifecycle — zero-row false-success guard", () => {
  it("check-in returns FAILURE when PATCH matches zero rows", async () => {
    const r = await checkInGuest(env, { reference: "MT-20260922-0001" });
    expect(r.ok).toBe(false);
    expect(r.changed).toBe(0);
  });

  it("check-in returns SUCCESS and reports 1 changed row when a booking matched", async () => {
    (globalThis as any).fetch = async (...args: any[]) => {
      calls.push(args);
      const url = decode(args[0]);
      const method = methodOf(args);
      if (url.includes("/rest/v1/bookings") && method === "PATCH") {
        return { ok: true, json: async () => [{ id: "uuid-1", status: "checked_in" }], status: 200, text: async () => "" };
      }
      return { ok: true, json: async () => [], status: 200, text: async () => "" };
    };
    const r = await checkInGuest(env, { reference: "MT-20260922-0001" });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(1);
  });
});

describe("booking lifecycle — coherent pending readback", () => {
  it("getGuestStayState surfaces a pending request (no duplicate) before confirmation", async () => {
    const fakeDb: any = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
    const state = await getGuestStayState(env, fakeDb, "marina_terrace", { name: "Eli" });
    expect(state.booking.length).toBe(1);
    expect(state.booking[0].status).toBe("pending");
    expect(state.booking[0].reference).toBe("MT-20260922-0001");
    expect(state.phase).not.toBeNull();
  });
});
