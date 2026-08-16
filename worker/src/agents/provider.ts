// OpenRouter LLM provider — calls OpenRouter API for chat completions.
// Supports env-driven model routing, OpenRouter provider latency-sorting, and a
// SHORT bounded fallback chain (long fallback chains turned 3s failures into
// 40s turns, so they are intentionally kept small).

import type { ConversationMessage, OpenRouterResponse } from "./types.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Model configuration — abstracted so it can be overridden per-tenant / per-env
// without code changes.
export interface ModelConfig {
  provider: string;
  model: string;
  // Ordered fallback chain (excluding the primary). Kept SHORT on purpose.
  models: string[];
  temperature: number;
  maxTokens: number;
  // OpenRouter provider-routing block (latency-sorted routing). Emitted only
  // when present; lets OpenRouter pick the fastest qualifying endpoint.
  providerRouting?: Record<string, unknown>;
}

/**
 * Resolve the model config from env. Defaults are optimized for INTERACTIVE,
 * low-latency, tool-capable voice/concierge turns.
 *
 * Env overrides (all optional):
 *   TALA_PRIMARY_MODEL      primary model id
 *   TALA_FALLBACK_MODELS    comma-separated fallback model ids (max 3)
 *   TALA_MAX_TOKENS         completion token cap (smaller = snappier)
 *   TALA_TEMPERATURE
 *   TALA_PROVIDER_ROUTING   "true" to enable OpenRouter latency-sorted routing
 *                           on the primary (ignores TALA_PRIMARY_MODEL and lets
 *                           OpenRouter pick the fastest parameter-supporting EP)
 *   TALA_PREFERRED_MAX_LATENCY  ms ceiling for provider routing (default 4000)
 */
export function resolveModelConfig(env: Record<string, any> | undefined): ModelConfig {
  const e = env ?? {};
  const fallbackRaw = typeof e.TALA_FALLBACK_MODELS === "string" ? e.TALA_FALLBACK_MODELS : "";
  const fallbacks = fallbackRaw
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const useRouting = String(e.TALA_PROVIDER_ROUTING ?? "true").toLowerCase() === "true";
  const preferredMaxLatency = Number(e.TALA_PREFERRED_MAX_LATENCY ?? 4000) || 4000;

  // Fast interactive default. OpenRouter auto-routing (require_parameters +
  // latency sort) picks the quickest parameter-supporting endpoint, which is
  // exactly what a tool-calling voice concierge needs.
  const primary = typeof e.TALA_PRIMARY_MODEL === "string" && e.TALA_PRIMARY_MODEL
    ? e.TALA_PRIMARY_MODEL
    : "openrouter/auto";

  const providerRouting = useRouting
    ? {
        require_parameters: true,
        sort: { by: "latency", partition: "none" },
        ...(preferredMaxLatency > 0 ? { preferred_max_latency: preferredMaxLatency } : {}),
      }
    : undefined;

  return {
    provider: "openrouter",
    model: primary,
    // Keep fallbacks SHORT. If none configured, a single reliable fast option.
    models: fallbacks.length
      ? fallbacks
      : ["google/gemini-2.0-flash-001", "anthropic/claude-3.5-haiku"],
    temperature: Number(e.TALA_TEMPERATURE ?? 0.4) || 0.4,
    maxTokens: Number(e.TALA_MAX_TOKENS ?? 400) || 400,
    providerRouting,
  };
}

export interface ChatRequest {
  messages: ConversationMessage[];
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: unknown;
    };
  }>;
  modelConfig?: Partial<ModelConfig>;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  finishReason: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Latency telemetry (no secrets / no reasoning). Added by TallaAgent.
  timing?: {
    totalMs: number;
    authMs: number;
    doMs: number;
    promptMs: number;
    llmMs: number;
    toolMs: number;
    deterministicMs: number;
    mode: "deterministic" | "conversational" | "agentic";
    modelCalls: number;
  };
}

/**
 * Call OpenRouter for a chat completion.
 * Tries the primary model first, then falls back through a SHORT chain.
 * Provider latency-routing (if configured) lets OpenRouter pick the fastest
 * qualifying endpoint for the primary. A bounded null-content retry protects
 * against models that return empty output; it never loops.
 */
export async function chatCompletion(
  apiKey: string,
  request: ChatRequest,
): Promise<ChatResponse> {
  const config = { ...resolveModelConfig(undefined), ...request.modelConfig };
  const models = [config.model, ...config.models.filter((m) => m !== config.model)].slice(0, 4);

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: request.messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        tools: request.tools?.length ? request.tools : undefined,
        tool_choice: request.tools?.length ? "auto" : undefined,
      };
      // Provider routing only on the primary slot (model === config.model).
      if (config.providerRouting && model === config.model) {
        body.provider = config.providerRouting;
      }

      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://marinaterrace.ph",
          "X-Title": "TALA - Marina Terrace",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        // On tool/function error, retry once without tools.
        if (response.status === 400 && errorText.includes("tool")) {
          const retryResponse = await fetch(OPENROUTER_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://marinaterrace.ph",
              "X-Title": "TALA - Marina Terrace",
            },
            body: JSON.stringify({
              model,
              messages: request.messages,
              temperature: config.temperature,
              max_tokens: config.maxTokens,
            }),
          });
          if (!retryResponse.ok) {
            throw new Error(`OpenRouter ${retryResponse.status}: ${errorText}`);
          }
          const retryData = (await retryResponse.json()) as OpenRouterResponse;
          return parseResponse(retryData);
        }
        // Rate limit / server error -> next model.
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`OpenRouter ${response.status} for ${model}`);
          continue;
        }
        throw new Error(`OpenRouter ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;

      // Reliability: some models return null content with no tool call even when
      // tools were offered. Retry ONCE with auto tool choice, then fall through.
      const offeredTools = request.tools?.length ? request.tools : undefined;
      const choice = data.choices?.[0];
      const noUsefulOutput =
        offeredTools &&
        choice &&
        choice.message.content === null &&
        (!choice.message.tool_calls || choice.message.tool_calls.length === 0);
      if (noUsefulOutput) {
        const retry = await fetch(OPENROUTER_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://marinaterrace.ph",
            "X-Title": "TALA - Marina Terrace",
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            tools: offeredTools,
            tool_choice: "auto",
          }),
        });
        if (retry.ok) {
          const retryData = (await retry.json()) as OpenRouterResponse;
          const retryChoice = retryData.choices?.[0];
          if (
            retryChoice &&
            (retryChoice.message.content !== null ||
              (retryChoice.message.tool_calls && retryChoice.message.tool_calls.length > 0))
          ) {
            return parseResponse(retryData);
          }
        }
        // Still nothing -> next model.
      }

      return parseResponse(data);
    } catch (err) {
      lastError = err as Error;
      // Continue to the next model on ANY failure (bounded short chain). Long
      // free-model fallback chains used to turn a 3s failure into a 40s turn; the
      // chain is now short, so walking it is cheap. Throw only after exhaustion.
      continue;
    }
  }

  throw lastError || new Error("All OpenRouter models failed");
}

function parseResponse(data: OpenRouterResponse): ChatResponse {
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("No response from OpenRouter");
  }

  // Some models (e.g. DeepSeek) emit DSML-format tool calls in `content`
  // instead of the standard OpenAI `tool_calls` array. Parse those when
  // tool_calls is empty so the agent loop can execute them.
  const toolCalls = (choice.message.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  // If standard tool_calls exist, use them (standard OpenAI format).
  // Otherwise, check for DSML format in content.
  let effectiveToolCalls = toolCalls;
  let effectiveContent = choice.message.content;

  if (effectiveToolCalls.length === 0 && effectiveContent && effectiveContent.length > 0) {
    const dsmlCalls = parseDsmlToolCalls(effectiveContent);
    if (dsmlCalls.length > 0) {
      effectiveToolCalls = dsmlCalls;
      // Strip DSML tags from content — keep only the user-facing text
      effectiveContent = stripDsmlTags(effectiveContent);
      if (effectiveContent && effectiveContent.trim().length === 0) {
        effectiveContent = null;
      }
    }
  }

  return {
    content: effectiveContent,
    toolCalls: effectiveToolCalls,
    finishReason: choice.finish_reason,
    model: data.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * Parse DSML-format tool calls from model content output.
 * Some models (e.g. DeepSeek) emit tool invocations as:
 *   <｜DSML｜invoke name="toolName">{"arg": "value"}</｜DSML｜invoke>
 * or:
 *   <｜DSML｜invoke name="toolName" args_key>args_value</｜DSML｜invoke>
 * This extracts them into the standard toolCalls format.
 */
function parseDsmlToolCalls(content: string): Array<{ id: string; name: string; arguments: string }> {
  const results: Array<{ id: string; name: string; arguments: string }> = [];
  // Match DSML invoke blocks
  const invokeRe = /<｜DSML｜invoke\s+([^>]+)>(.*?)<｜\/DSML｜invoke>/gs;
  let m: RegExpExecArray | null;
  while ((m = invokeRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2].trim();
    // Extract name attribute
    const nameMatch = attrs.match(/name\s*=\s*"([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    // Extract arguments — try JSON first, fall back to key-value parsing
    let argumentsStr = "{}";
    try {
      // Try JSON parse of body
      JSON.parse(body);
      argumentsStr = body;
    } catch {
      // Parse key-value format: key>value pairs
      const argPairs: Record<string, string> = {};
      const argRe = /(\w+)>([^<]+)/g;
      let am: RegExpExecArray | null;
      while ((am = argRe.exec(body)) !== null) {
        argPairs[am[1]] = am[2].trim();
      }
      if (Object.keys(argPairs).length > 0) {
        argumentsStr = JSON.stringify(argPairs);
      }
    }

    results.push({
      id: `dsml_${results.length}_${Date.now()}`,
      name,
      arguments: argumentsStr,
    });
  }
  return results;
}

/**
 * Strip DSML tool-call tags from content, leaving only user-facing text.
 */
function stripDsmlTags(content: string): string | null {
  // Remove entire DSML blocks including their content
  const stripped = content
    .replace(/<｜DSML｜tool_calls>.*?<｜\/DSML｜tool_calls>/gs, "")
    .replace(/<｜DSML｜invoke[^>]*>.*?<｜\/DSML｜invoke>/gs, "")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

/**
 * Streaming chat completion (SSE from OpenRouter). Yields only user-visible
 * assistant text deltas — never tool-call JSON or chain-of-thought. Captures
 * the final model/usage from the terminal chunk when available.
 *
 * Streaming is used ONLY for tool-free calls (conversational fast path and the
 * final natural answer after a tool loop), so we never stream raw tool args.
 *
 * Resilient: supports an AbortSignal for client barge-in cancellation. Primary
 * model only (the fast path does not need the fallback chain); on failure it
 * throws so the caller can fall back to a non-streaming JSON call.
 */
export async function* chatCompletionStream(
  apiKey: string,
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<{ delta: string; model?: string; usage?: ChatResponse["usage"] }, void, unknown> {
  const config = { ...resolveModelConfig(undefined), ...request.modelConfig };
  const model = config.model;
  const body: Record<string, unknown> = {
    model,
    messages: request.messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (config.providerRouting) {
    body.provider = config.providerRouting;
  }

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://marinaterrace.ph",
      "X-Title": "TALA - Marina Terrace",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${errorText}`);
  }
  if (!response.body) {
    throw new Error("OpenRouter returned no stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastModel: string | undefined;
  let lastUsage: ChatResponse["usage"];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        let json: Record<string, any>;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }
        if (json.model) lastModel = json.model;
        if (json.usage) {
          lastUsage = {
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          };
        }
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield { delta, model: lastModel, usage: lastUsage };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  // Emit a terminal chunk carrying model/usage even if no deltas arrived last.
  yield { delta: "", model: lastModel, usage: lastUsage };
}
