// Cloudflare Talla chat adapter.
// Connects the existing TalaWidget to the new Cloudflare TallaAgent DO.
// Implements the same interface as useTalaChat for seamless swapping.

import { getTallaAgentUrl } from "./tallaFeatureFlag";

export interface CloudflareChatResponse {
  content: string | null;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Send a message to the Cloudflare TallaAgent via HTTP.
 * The DO handles LLM reasoning, tool execution, and response.
 */
export async function sendToCloudflareAgent(
  message: string,
  context: {
    tenantId: string;
    userId?: string;
    role?: string;
    guestName?: string;
    guestRoom?: string;
  },
): Promise<string | null> {
  const workerUrl = getTallaAgentUrl();
  if (!workerUrl) {
    console.error("[CloudflareChat] No VITE_WORKER_URL configured");
    return null;
  }

  try {
    const response = await fetch(`${workerUrl}/api/talla/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        ...context,
      }),
    });

    if (!response.ok) {
      console.error(`[CloudflareChat] HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { content?: string; error?: string };

    if (data.error) {
      console.error(`[CloudflareChat] Error: ${data.error}`);
      return null;
    }

    return data.content || null;
  } catch (err) {
    console.error("[CloudflareChat] Request failed:", err);
    return null;
  }
}
