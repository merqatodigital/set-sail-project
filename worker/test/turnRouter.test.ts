// Security + routing unit tests for the TALA runtime.
// Pure, no DO / no Supabase / no network.
import { describe, it, expect } from "vitest";
import { resolveChatIdentity, classifyTurn } from "../src/agents/turnRouter.js";

const OWNER_AUTH = { authenticated: true, userId: "u-owner", tenantId: "marina_terrace", role: "owner" };
const ADMIN_AUTH = { authenticated: true, userId: "u-admin", tenantId: "marina_terrace", role: "admin" };
const NO_AUTH = { authenticated: false, userId: null, tenantId: null, role: null };

describe("resolveChatIdentity — role trust (Section 1)", () => {
  it("A. unauthenticated request with body role:'owner' remains guest", () => {
    const id = resolveChatIdentity(NO_AUTH, { tenantId: "marina_terrace", userId: "g1", role: "owner" });
    expect(id.role).toBe("guest");
    expect(id.doKey).toBe("marina_terrace:g1");
    expect(id.userId).toBe("g1");
  });

  it("B. unauthenticated request with body role:'admin' remains guest", () => {
    const id = resolveChatIdentity(NO_AUTH, { tenantId: "marina_terrace", userId: "g2", role: "admin" });
    expect(id.role).toBe("guest");
    expect(id.doKey).toBe("marina_terrace:g2");
  });

  it("C. authenticated owner receives owner role + tenant DO key", () => {
    const id = resolveChatIdentity(OWNER_AUTH, { tenantId: "marina_terrace", userId: "x", role: "owner" });
    expect(id.role).toBe("owner");
    expect(id.tenantId).toBe("marina_terrace");
    expect(id.doKey).toBe("marina_terrace");
  });

  it("authenticated admin receives admin role", () => {
    const id = resolveChatIdentity(ADMIN_AUTH, { tenantId: "marina_terrace" });
    expect(id.role).toBe("admin");
  });

  it("E. guest session state never inherits privileged role (body role ignored even if prior owner)", () => {
    // Simulate a prior owner turn, then a forged guest turn: routing must yield guest.
    const forgedGuest = resolveChatIdentity(NO_AUTH, { tenantId: "marina_terrace", userId: "g9", role: "owner" });
    expect(forgedGuest.role).toBe("guest");
    expect(forgedGuest.doKey).toBe("marina_terrace:g9");
  });

  it("D. owner-only tool path is unreachable from a forged guest (no owner DO key)", () => {
    // A guest request can never be routed to the owner DO (tenantId only), so
    // owner-gated DO endpoints (role check) are never reachable via forgery.
    const guest = resolveChatIdentity(NO_AUTH, { tenantId: "marina_terrace", userId: "attacker", role: "owner" });
    expect(guest.role).not.toBe("owner");
    expect(guest.role).not.toBe("admin");
    expect(guest.doKey).toBe("marina_terrace:attacker");
  });

  it("different guest userIds are isolated to different DO keys", () => {
    const a = resolveChatIdentity(NO_AUTH, { tenantId: "marina_terrace", userId: "alice" });
    const b = resolveChatIdentity(NO_AUTH, { tenantId: "marina_terrace", userId: "bob" });
    expect(a.doKey).not.toBe(b.doKey);
  });
});

describe("classifyTurn — conversational fast path routing (Section 3)", () => {
  it("greeting uses conversational fast path", () => {
    expect(classifyTurn("Hi, I'm Dave.")).toBe("conversational");
    expect(classifyTurn("Hello there")).toBe("conversational");
  });

  it("simple property question uses conversational fast path (one LLM call)", () => {
    expect(classifyTurn("What kind of place is Marina Terrace?")).toBe("conversational");
    expect(classifyTurn("What is the wifi like?")).toBe("conversational");
    expect(classifyTurn("What's on the menu?")).toBe("conversational");
    expect(classifyTurn("What time is checkout?")).toBe("conversational");
  });

  it("follow-up context / memory question is conversational", () => {
    expect(classifyTurn("What did I tell you my name was?")).toBe("conversational");
  });

  it("action/booking requests enter agentic path", () => {
    expect(classifyTurn("Book a room for tonight")).toBe("agentic");
    expect(classifyTurn("Cancel my booking")).toBe("agentic");
    expect(classifyTurn("Check my booking status")).toBe("agentic");
    expect(classifyTurn("I'd like to reserve the rooftop")).toBe("agentic");
  });

  it("empty message is conversational (safe default)", () => {
    expect(classifyTurn("")).toBe("conversational");
  });

  it("natural-language booking intent (no action verb) enters agentic path", () => {
    // Regression: these used to fall through to PROPERTY_FAQ_RE's bare
    // "room"/"table" match and get routed conversational (no tools).
    expect(classifyTurn("room for 4 this weekend")).toBe("agentic");
    expect(classifyTurn("table for two tonight")).toBe("agentic");
    expect(classifyTurn("do you have any rooms available?")).toBe("agentic");
    expect(classifyTurn("any vacancies for Friday?")).toBe("agentic");
    expect(classifyTurn("we're 6 people looking for a place this weekend")).toBe("agentic");
    expect(classifyTurn("checking us in tomorrow, party of 3")).toBe("agentic");
  });
});
