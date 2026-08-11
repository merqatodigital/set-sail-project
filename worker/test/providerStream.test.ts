// Streaming provider test — verifies SSE parsing yields only user-visible text
// deltas, captures final model/usage, and surfaces errors.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chatCompletionStream } from "../src/agents/provider.js";

function sseChunk(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

const SSE_BODY =
  sseChunk({ model: "openrouter/auto", choices: [{ delta: { content: "Absolutely" } }] }) +
  sseChunk({ model: "openrouter/auto", choices: [{ delta: { content: ". The rooftop" } }] }) +
  sseChunk({ model: "openrouter/auto", choices: [{ delta: { content: " workspace is open." } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) +
  sseChunk("[DONE]");

describe("chatCompletionStream", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      body: {
        getReader() {
          const data = new TextEncoder().encode(SSE_BODY);
          let pos = 0;
          return {
            read() {
              if (pos >= data.length) return Promise.resolve({ done: true, value: undefined });
              const end = data.length;
              const slice = data.subarray(pos, end);
              pos = end;
              return Promise.resolve({ done: false, value: slice });
            },
            releaseLock() {},
          };
        },
      },
    })) as unknown as ReturnType<typeof vi.fn>;
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("yields only text deltas and captures model/usage", async () => {
    const deltas: string[] = [];
    let model: string | undefined;
    let usage: unknown;
    for await (const c of chatCompletionStream("fake-key", { messages: [{ role: "user", content: "hi" }] })) {
      if (c.delta) deltas.push(c.delta);
      if (c.model) model = c.model;
      if (c.usage) usage = c.usage;
    }
    expect(deltas.join("")).toBe("Absolutely. The rooftop workspace is open.");
    expect(model).toBe("openrouter/auto");
    expect(usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("does not leak tool-call JSON or chain-of-thought", async () => {
    const bodyWithTools = sseChunk({ choices: [{ delta: { content: "Hi", tool_calls: [{ id: "1", function: { name: "book", arguments: "{}" } }] } }] }) + sseChunk("[DONE]");
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      body: {
        getReader() {
          const data = new TextEncoder().encode(bodyWithTools);
          let pos = 0;
          return { read() { if (pos >= data.length) return Promise.resolve({ done: true, value: undefined }); const s = data.subarray(pos); pos = data.length; return Promise.resolve({ done: false, value: s }); }, releaseLock() {} };
        },
      },
    }));
    const deltas: string[] = [];
    for await (const c of chatCompletionStream("fake-key", { messages: [{ role: "user", content: "hi" }] })) {
      if (c.delta) deltas.push(c.delta);
    }
    // Even if a tool_call delta appeared in the stream, we only emit text.
    expect(deltas.join("")).toBe("Hi");
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, text: async () => "boom" }));
    await expect(async () => {
      for await (const _ of chatCompletionStream("fake-key", { messages: [{ role: "user", content: "hi" }] })) { /* drain */ }
    }).rejects.toThrow();
  });
});
