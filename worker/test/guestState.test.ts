// Guest-state adapter tests — role security, self-scope, cross-guest denial,
// folio explicit-link behavior, and the provider null-content retry.
// Supabase is mocked via global.fetch; D1 audit is a no-op fake.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc_key",
} as unknown as import("../src/env.js").Env;

function fakeDb(): any {
  return {
    prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
  };
}

function makeCtx(role: string, guestName?: string, guestPhone?: string): any {
  return {
    db: fakeDb(),
    env,
    tenantId: "marina_terrace",
    role,
    guestName: guestName ?? null,
    guestPhone: guestPhone ?? undefined,
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
  return { ok: true, json: async () => rows, status: 200, text: async () => "" };
}

function decodedUrl(): string {
  return decodeURIComponent(fetchMock.mock.calls[0][0] as string);
}

async function importTools() {
  return await import("../src/agents/tools/guestStateTools.js");
}

describe("guest-state role security", () => {
  it("guest with no identity is denied", async () => {
    const t = await importTools();
    const res = await t.getGuestStayTool.execute!({}, makeCtx("guest"));
    expect(res.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("guest reads only SELF (ignores supplied name)", async () => {
    const t = await importTools();
    fetchMock.mockResolvedValue(sbJson([{ id: "b1", guest_name: "Alice", room_type: "Studio", check_in: "2026-09-01", check_out: "2026-09-05", status: "confirmed", amount: 5000, paid_amount: 5000, notes: "" }]));
    const res = await t.getGuestStayTool.execute!({ guestName: "Bob" }, makeCtx("guest", "Alice", "+639"));
    expect(res.success).toBe(true);
    // Supabase must have been queried with Alice, NOT Bob
    const url = decodedUrl();
    expect(url).toContain("guest_name=eq.Alice");
    expect(url).not.toContain("Bob");
  });

  it("owner may look up another guest by name", async () => {
    const t = await importTools();
    fetchMock.mockResolvedValue(sbJson([{ id: "b2", guest_name: "Carol", room_type: "Loft", check_in: "2026-09-02", check_out: "2026-09-04", status: "pending", amount: 3000, paid_amount: 0, notes: "" }]));
    const res = await t.getGuestStayTool.execute!({ guestName: "Carol" }, makeCtx("owner"));
    expect(res.success).toBe(true);
    const url = decodedUrl();
    expect(url).toContain("guest_name=eq.Carol");
  });

  it("guest cross-guest denial: supplying another name is ignored", async () => {
    const t = await importTools();
    fetchMock.mockResolvedValue(sbJson([{ id: "b3", guest_name: "Dave", room_type: "Suite", check_in: "2026-09-03", check_out: "2026-09-06", status: "confirmed", amount: 9000, paid_amount: 9000, notes: "" }]));
    // Guest claims to be Dave but session identity is Eve -> must query Eve only
    const ctx = makeCtx("guest", "Eve", "+111");
    const res = await t.getGuestStayTool.execute!({ guestName: "Dave" }, ctx);
    expect(res.success).toBe(true);
    const url = decodedUrl();
    expect(url).toContain("guest_name=eq.Eve");
    expect(url).not.toContain("Dave");
  });
});

describe("folio explicit-link behavior", () => {
  it("computes balance from explicit related_id lines; reports unlinked as unresolved", async () => {
    const t = await importTools();
    fetchMock.mockResolvedValue(sbJson([
      { id: "f1", kind: "charge", category: "room", description: "Stay", amount: 5000, method: "cash", reference: "r1", related_type: "booking", related_id: "b1", guest_name: "Alice", guest_phone: "+639" },
      { id: "f2", kind: "payment", category: "room", description: "Paid", amount: 5000, method: "gcash", reference: "p1", related_type: "booking", related_id: "b1", guest_name: "Alice", guest_phone: "+639" },
      { id: "f3", kind: "charge", category: "food", description: "Orphan", amount: 250, method: "cash", reference: "", related_type: "", related_id: "", guest_name: "Alice", guest_phone: "+639" },
    ]));
    const res = await t.getGuestFolioTool.execute!({}, makeCtx("guest", "Alice", "+639"));
    expect(res.success).toBe(true);
    const d = res.data as any;
    expect(d.totalCharges).toBe(5250);
    expect(d.totalPaid).toBe(5000);
    expect(d.balance).toBe(250);
    expect(d.unresolved.length).toBe(1);
    expect(d.unresolved[0].id).toBe("f3");
  });
});

describe("writeGuestMessage", () => {
  it("owner can persist a message into tala_guest_messages (source=tala_chat)", async () => {
    const t = await importTools();
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}), text: async () => "" });
    const res = await t.writeGuestMessageTool.execute!(
      { guestName: "Alice", guestPhone: "+639", message: "Tour confirmed" },
      makeCtx("owner"),
    );
    expect(res.success).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.guest_name).toBe("Alice");
    expect(body.source).toBe("tala_chat");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("tala_guest_messages");
  });
});

describe("provider null-content retry", () => {
  it("retries once with tool_choice required when model returns null content and no tool call", async () => {
    const { chatCompletion } = await import("../src/agents/provider.js");
    const toolCallResp = {
      choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "getGuestStay", arguments: "{}" } }] }, finish_reason: "tool_calls" }],
      model: "openai/gpt-oss-20b:free",
    };
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [] }, finish_reason: "stop" }], model: "openai/gpt-oss-20b:free" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => toolCallResp });

    const res = await chatCompletion("fake-key", {
      messages: [{ role: "user", content: "when do I check out?" }],
      tools: [{ type: "function", function: { name: "getGuestStay", description: "", parameters: {} } }],
    });
    expect(res.toolCalls.length).toBe(1);
    expect(res.toolCalls[0].name).toBe("getGuestStay");
    // Second call must force tool_choice: required
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.tool_choice).toBe("required");
  });
});
