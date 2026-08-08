// OpenRouter LLM provider — calls OpenRouter API for chat completions.
// Supports model fallback and tool calling.

import type { ConversationMessage, OpenRouterResponse } from "./types.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Model configuration — abstracted for future per-tenant BYO-key support.
export interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: "openrouter",
  model: "openai/gpt-oss-20b:free",
  temperature: 0.5,
  maxTokens: 600,
};

// Free model fallback chain — matches existing talaConfig.ts
const FREE_MODELS = [
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

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
}

/**
 * Call OpenRouter for a chat completion.
 * Tries the preferred model first, then falls back through FREE_MODELS.
 */
export async function chatCompletion(
  apiKey: string,
  request: ChatRequest,
): Promise<ChatResponse> {
  const config = { ...DEFAULT_MODEL_CONFIG, ...request.modelConfig };
  const models = [config.model, ...FREE_MODELS.filter((m) => m !== config.model)];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
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
          tools: request.tools?.length ? request.tools : undefined,
          tool_choice: request.tools?.length ? "auto" : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        // On tool/function error, retry without tools
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

        // On rate limit or server error, try next model
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`OpenRouter ${response.status} for ${model}`);
          continue;
        }

        throw new Error(`OpenRouter ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;
      return parseResponse(data);
    } catch (err) {
      lastError = err as Error;
      // Only continue to next model on specific errors
      if (err instanceof Error && (err.message.includes("429") || err.message.includes("500"))) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All OpenRouter models failed");
}

function parseResponse(data: OpenRouterResponse): ChatResponse {
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("No response from OpenRouter");
  }

  return {
    content: choice.message.content,
    toolCalls: (choice.message.tool_calls || []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })),
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
