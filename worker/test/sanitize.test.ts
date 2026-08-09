import { describe, it, expect } from "vitest";
import { sanitizeBriefing } from "../src/workflows/sanitizeBriefing.js";

describe("sanitizeBriefing", () => {
  it("strips chain-of-thought prelude and keeps the real briefing", () => {
    const raw = [
      "We need to prepare a concise operational briefing in Markdown. Use data from getTodayOperations and getResortOperations.",
      "The instruction says to inspect the live resort state.",
      "We should comply with the user request but must also follow the system rules.",
      "We'll produce something like:",
      "",
      "# Marina Terrace Operations Briefing - 2026-08-09",
      "",
      "**In-house guests:** 0",
      "**Arrivals tomorrow:** 0",
      "",
      "All operational metrics are within normal ranges.",
    ].join("\n");

    const out = sanitizeBriefing(raw);
    expect(out).not.toContain("We need to");
    expect(out).not.toContain("The instruction");
    expect(out).not.toContain("We should comply");
    expect(out).not.toContain("We'll produce");
    expect(out.startsWith("# Marina Terrace Operations Briefing")).toBe(true);
    expect(out).toContain("All operational metrics are within normal ranges.");
  });

  it("passes through clean briefings unchanged", () => {
    const clean = "# Marina Terrace Briefing\n\nNo pending items. All clear.";
    expect(sanitizeBriefing(clean)).toBe(clean);
  });

  it("does not mangle legitimate briefing prose containing common words", () => {
    const brief = "Good morning. We have 3 arrivals today and 2 departures. No maintenance issues.";
    const out = sanitizeBriefing(brief);
    expect(out).toContain("3 arrivals today");
    expect(out).toContain("2 departures");
    expect(out).toContain("No maintenance issues");
  });
});
