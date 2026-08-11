import { useCallback, useRef, useState } from "react";
import {
  OPENROUTER_ENDPOINT,
  TALA_CHAT_ENDPOINT,
  TALA_FREE_MODELS,
  TALA_MAX_HISTORY,
  TALA_STORAGE,
  TALA_SUPABASE_ANON_KEY,
  type TalaMessage,
} from "./talaConfig";
import {
  TALA_TOOL_SCHEMAS,
  executeTalaTool,
  captureGuestLead,
  confirmBookingDraft,
  type TalaToolContext,
} from "./talaTools";
import {
  classifyHeuristically,
  writeAuditEntry,
  type TalaClassification,
} from "./talaGraph";
import { detectSentiment, sentimentInstruction } from "./talaSentiment";
import { useCms } from "@/context/CmsContext";
import type { CmsData } from "@/types/cms";
import { getTallaAgentUrl } from "@/lib/tallaFeatureFlag";

interface ToolCallWire {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallWire[];
  tool_call_id?: string;
}

interface AssistantReply {
  content: string | null;
  tool_calls?: ToolCallWire[];
}

const MAX_TOOL_HOPS = 3;

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDevApiKey(): string {
  try {
    return localStorage.getItem(TALA_STORAGE.devApiKey) ?? "";
  } catch {
    return "";
  }
}

export function setDevApiKey(key: string) {
  try {
    if (key) localStorage.setItem(TALA_STORAGE.devApiKey, key);
    else localStorage.removeItem(TALA_STORAGE.devApiKey);
  } catch {
    /* storage unavailable (private mode) — dev key just won't persist */
  }
}

/**
 * Stable per-browser guest session id. The public orb is unauthenticated, so
 * we mint a random id stored in localStorage and reuse it for the chat
 * session. This isolates each visitor's conversation in the Cloudflare
 * TallaAgent Durable Object (keyed tenantId:userId) so two guests never share
 * history or private context.
 */
export function getGuestSessionId(): string {
  try {
    const KEY = "tala.guestSessionId";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `guest-anon-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Direct browser → OpenRouter call. Dev/building mode only: used when a key
 * is stored locally on this device. Production traffic should go through the
 * tala-chat edge function so the key is never exposed.
 *
 * @param preferredModel the model chosen in Admin → TALA, tried first before
 *                        falling back to the free-model chain.
 */
async function requestChatCompletion(
  model: string,
  messages: WireMessage[],
  apiKey: string,
  includeTools: boolean,
): Promise<{ ok: true; message: AssistantReply } | { ok: false; status: number; error: string }> {
  const body: Record<string, unknown> = { model, messages, temperature: 0.5, max_tokens: 600 };
  if (includeTools) {
    body.tools = TALA_TOOL_SCHEMAS;
    body.tool_choice = "auto";
  }
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      // Header values must be Latin-1 — no em dashes or other non-ASCII characters.
      "X-Title": "TALA - San Vicente Concierge",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    return {
      ok: false,
      status: res.status,
      error: errBody?.error?.message || `HTTP ${res.status}`,
    };
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  return { ok: true, message: { content: msg?.content ?? null, tool_calls: msg?.tool_calls } };
}

async function askOpenRouterDirect(
  messages: WireMessage[],
  apiKey: string,
  preferredModel?: string,
): Promise<AssistantReply> {
  const chain = preferredModel
    ? [preferredModel, ...TALA_FREE_MODELS.filter((m) => m !== preferredModel)]
    : TALA_FREE_MODELS;
  let lastError = "";
  for (const model of chain) {
    try {
      let result = await requestChatCompletion(model, messages, apiKey, true);
      // Not every free/open model supports function-calling — if the API
      // rejects the `tools` param outright, retry that same model without
      // it rather than treating it as dead.
      if (!result.ok && result.status === 400 && /tool|function/i.test(result.error)) {
        result = await requestChatCompletion(model, messages, apiKey, false);
      }
      if (!result.ok) {
        lastError = `${model}: ${result.error}`;
        // 429 = free-tier rate limit, 404 = model retired — try the next one.
        if (result.status === 429 || result.status === 404 || result.status >= 500) continue;
        throw new Error(lastError);
      }
      if (result.message.content || result.message.tool_calls?.length) return result.message;
      lastError = `${model}: empty response`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError || "All free models are busy right now.");
}

/** Production path: Supabase Edge Function proxy (key lives in Supabase secrets). */
async function askEdgeFunction(
  messages: WireMessage[],
  preferredModel?: string,
): Promise<AssistantReply> {
  if (!TALA_CHAT_ENDPOINT) throw new Error("Supabase is not configured.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TALA_SUPABASE_ANON_KEY) {
    headers.apikey = TALA_SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${TALA_SUPABASE_ANON_KEY}`;
  }
  const res = await fetch(TALA_CHAT_ENDPOINT, {
    method: "POST",
    headers,
    // Tool schemas are NOT sent here — the edge function only trusts its own
    // hardcoded copy (see supabase/functions/tala-chat/index.ts), not
    // anything a client could supply.
    body: JSON.stringify({ messages, model: preferredModel || undefined }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  }
  // The edge function already runs the full agent<->tools loop server-side
  // and returns only the final text as { reply }. It never sends tool_calls
  // back to the client — that's why this reads `reply`, not `message`.
  const content = typeof data?.reply === "string" ? data.reply.trim() : "";
  if (!content) {
    throw new Error("TALA returned an empty reply.");
  }
  return { content, tool_calls: undefined };
}

/**
 * Public guest path — routes through the SAME Cloudflare TallaAgent that
 * powers Admin Ask TALA (one brain). The worker runs the full LLM + tool loop
 * server-side and returns only the final text as { content }. Guest role is
 * sent explicitly so the agent exposes only guest-safe tools (property, tours,
 * menu, inventory, guest requests) and never owner ops / Computer / private
 * data. A per-session guest id isolates each visitor's conversation.
 */
async function askCloudflareAgent(
  messages: WireMessage[],
  preferredModel?: string,
): Promise<AssistantReply> {
  const workerUrl = getTallaAgentUrl();
  if (!workerUrl) throw new Error("TALA worker is not configured.");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content || "";
  if (!text.trim()) throw new Error("Empty message.");
  const res = await fetch(`${workerUrl}/api/talla/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      tenantId: "marina_terrace",
      role: "guest",
      userId: getGuestSessionId(),
      model: preferredModel || undefined,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  }
  const content = typeof data?.content === "string" ? data.content.trim() : "";
  if (!content) throw new Error("TALA returned an empty reply.");
  // The worker runs its own tools server-side, so no tool_calls are returned
  // to the client — the frontend tool loop below stays inert for guests.
  return { content, tool_calls: undefined };
}

/**
 * Workspace Day Pass — a structured, single-purpose request sent to the SAME
 * Cloudflare TallaAgent used by chat. The worker resolves it through
 * requestRoomBooking (roomType "Day Pass", checkIn = the chosen day, checkOut =
 * the next day, guests 1), which hard-enforces all required fields server-side,
 * dedupes a pending request, and persists ONE row to tala_booking_requests
 * (status pending, MT- reference). We never craft pricing client-side — the
 * day pass price shown in the form comes from cms_data.pricing, and the worker
 * ignores any guest-supplied amount.
 */
export interface RequestDayPassInput {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  day: string; // ISO YYYY-MM-DD
  guests?: number; // people on the pass (>= 1)
  notes?: string; // arrival time, allergies, dietary needs, food add-on fallback
}

export async function requestDayPass(
  input: RequestDayPassInput,
  preferredModel?: string,
): Promise<{ content: string; reference: string | null }> {
  const day = input.day.slice(0, 10);
  const { addDays } = await import("./talaDate");
  const next = addDays(day, 1);
  const guests = Math.max(1, Math.floor(input.guests ?? 1));
  const notes = (input.notes || "").trim();
  const text = [
    `I'd like to book a Workspace Day Pass on ${day} for ${guests} guest${guests > 1 ? "s" : ""}.`,
    `My name is ${input.guestName}.`,
    `My email is ${input.guestEmail}.`,
    `My WhatsApp/mobile number is ${input.guestPhone}.`,
    `Check-in ${day}, check-out ${next} (single day pass).`,
    notes ? `Additional requests: ${notes}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const reply = await askCloudflareAgent([{ role: "user", content: text }], preferredModel);
  const match = reply.content?.match(/\bMT-\d{8}-\d{4}\b/);
  return { content: reply.content || "", reference: match ? match[0] : null };
}

/**
 * Classify node of the agent graph — uses deterministic keyword rules only.
 * No extra LLM call needed. Fast, free, and reliable.
 */
export interface TalaRunInfo {
  classification: TalaClassification;
  toolsUsed: string[];
}

export interface UseTalaChat {
  messages: TalaMessage[];
  thinking: boolean;
  error: string | null;
  /** Booking draft returned by request_booking (guest mode) awaiting confirm. */
  pendingDraft: BookingDraft | null;
  /** Classification + tools from the most recent completed turn (agent-graph telemetry). */
  lastRun: TalaRunInfo | null;
  /** Device-measured round-trip of the most recent turn (send → final reply), in ms. */
  lastTurn: { ms: number; text: string } | null;
  send: (
    text: string,
    systemPrompt: string,
    options?: {
      model?: string;
      adminApiKey?: string;
      cms?: CmsData;
      /** Operator face only — allows TALA to write bookings/tours/rentals. */
      owner?: boolean;
    },
  ) => Promise<string | null>;
  /** Persists a guest-confirmed booking draft (the human Confirm action). */
  confirmDraft: (
    extra?: { email?: string; nomad?: boolean; working?: boolean; tours?: string[] },
  ) => void;
  /** Dismisses the pending draft card without confirming. */
  clearDraft: () => void;
  reset: () => void;
}

interface BookingDraft {
  id: string;
  reference: string;
  guestName: string;
  guestPhone: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  amount: number;
  notes: string;
}

export function useTalaChat(): UseTalaChat {
  const [messages, setMessages] = useState<TalaMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<TalaRunInfo | null>(null);
  const [pendingDraft, setPendingDraft] = useState<BookingDraft | null>(null);
  const [lastTurn, setLastTurn] = useState<{ ms: number; text: string } | null>(null);
  const inFlight = useRef(false);
  // Use the shared CMS store so owner-mode writes persist exactly like the
  // admin managers do (through CmsContext -> cms_data).
  const { update: persistCms } = useCms();
  // Authoritative copy of the conversation. React state updaters are NOT
  // guaranteed to run synchronously at the setMessages() call site, so
  // building the outgoing request from inside one silently dropped the
  // user's newest message whenever React deferred the updater — the model
  // then answered a conversation containing only the system prompt.
  const messagesRef = useRef<TalaMessage[]>([]);

  const send = useCallback(
    async (
      text: string,
      systemPrompt: string,
      options?: { model?: string; adminApiKey?: string; cms?: CmsData; owner?: boolean },
    ): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed || inFlight.current) return null;
      inFlight.current = true;
      setError(null);
      setThinking(true);
      const turnStart = performance.now();

      const preferredModel = options?.model;
      const userMsg: TalaMessage = { id: newId(), role: "user", content: trimmed };
      const history: TalaMessage[] = [...messagesRef.current, userMsg];
      messagesRef.current = history;
      setMessages(history);

      // Auto-capture a lead whenever a guest shares a contact/name — even if
      // the chat never reaches a booking. Skipped for the operator face.
      if (!options?.owner) {
        void captureGuestLead(trimmed, options?.cms?.settings?.siteName || "guest");
      }

      let wire: WireMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-TALA_MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
      ];

      // Sentiment analysis — inject context-aware instructions into the prompt
      const sentiment = detectSentiment(trimmed);
      const sentimentNote = sentimentInstruction(sentiment);
      if (sentimentNote) {
        wire.splice(1, 0, { role: "system", content: `[Guest sentiment: ${sentiment.sentiment} (${Math.round(sentiment.confidence * 100)}% confidence). ${sentimentNote}]` });
      }

      // Time-of-day context injection for proactive behavior
      const hour = new Date().getHours();
      if (hour >= 16 && hour <= 17) {
        wire.splice(1, 0, { role: "system", content: "[Context: It's late afternoon — sunset session is happening now. Mention it if relevant.]" });
      } else if (hour >= 7 && hour <= 10) {
        wire.splice(1, 0, { role: "system", content: "[Context: It's morning — breakfast is being served. Mention it if relevant.]" });
      } else if (hour >= 12 && hour <= 14) {
        wire.splice(1, 0, { role: "system", content: "[Context: It's lunch time. Mention the menu if relevant.]" });
      }

      // Weather context injection — fetches from OpenWeatherMap (cached 30 min)
      // Runs in PARALLEL with the LLM call to save 200-500ms
      const weatherPromise = import("./talaWeather")
        .then(({ buildWeatherContext }) => buildWeatherContext())
        .catch(() => null);

      try {
        // Priority: key entered in Admin → TALA (works instantly, no deploy
        // needed) → device-local dev key (building on this browser only) →
        // Supabase edge function (production path, key stays server-side).
        const key = options?.adminApiKey || getDevApiKey();
        // A direct browser->OpenRouter call can fail for reasons that have
        // nothing to do with the visitor (key revoked, out of credits, 401
        // "User not found"). That used to surface as "TALA hit a snag" for
        // everyone, so always fall back to the server-side edge function,
        // which holds its own key.
        let directDead = false;
        const requestReply = async (msgs: WireMessage[]): Promise<AssistantReply> => {
          if (key && !directDead) {
            try {
              return await askOpenRouterDirect(msgs, key, preferredModel);
            } catch (e) {
              console.warn("[TALA] Direct OpenRouter call failed, using server proxy.", e);
              directDead = true;
            }
          }
          // Public guest path: use the same Cloudflare TallaAgent as Admin
          // (one brain). Owner/dev-key paths keep their existing behavior.
          if (!options?.owner) {
            return askCloudflareAgent(msgs, preferredModel);
          }
          return askEdgeFunction(msgs, preferredModel);
        };

        // Graph node 2 — agent: the tool-calling loop.
        const toolsUsed: string[] = [];
        let reply = await requestReply(wire);

        // Inject weather context into wire after LLM call returns (parallel)
        const weatherCtx = await weatherPromise;
        if (weatherCtx?.suggestion) {
          wire.splice(1, 0, { role: "system", content: `[Weather: ${weatherCtx.suggestion}]` });
        }
        let hops = 0;
        while (reply.tool_calls?.length && hops < MAX_TOOL_HOPS) {
          hops++;
          wire = [
            ...wire,
            { role: "assistant", content: reply.content, tool_calls: reply.tool_calls },
          ];
          // Execute ALL tool calls in parallel (saves 50-200ms per extra tool)
          const toolCtx: TalaToolContext = {
            cms: options?.cms!,
            update: options?.owner ? persistCms : undefined,
            owner: !!options?.owner,
          };
          const toolResults = await Promise.all(
            reply.tool_calls.map(async (call) => {
              toolsUsed.push(call.function.name);
              const result = options?.cms
                ? await executeTalaTool(
                    { id: call.id, name: call.function.name, arguments: call.function.arguments },
                    toolCtx,
                  )
                : { error: "Tool unavailable — no site data loaded." };
              const draft = (result as { draft?: BookingDraft }).draft;
              if (draft) setPendingDraft(draft);
              return { role: "tool" as const, tool_call_id: call.id, content: JSON.stringify(result) };
            }),
          );
          wire = [...wire, ...toolResults];
          reply = await requestReply(wire);
        }

        const finalText = reply.content?.trim();
        if (!finalText) throw new Error("TALA didn't have a reply.");

        messagesRef.current = [
          ...messagesRef.current,
          { id: newId(), role: "assistant", content: finalText },
        ];
        setMessages(messagesRef.current);

        // Graph node 3 — audit. Never blocks or breaks the reply.
        // Use deterministic heuristics only — no extra LLM call needed.
        const classification = classifyHeuristically(trimmed);
        setLastRun({ classification, toolsUsed });
        writeAuditEntry({
          classification,
          guestMessage: trimmed,
          replyPreview: finalText,
          toolsUsed,
          sentiment: sentiment.sentiment,
        });

        const turnMs = Math.round(performance.now() - turnStart);
        console.debug(`[TALA] reply round-trip ${turnMs}ms`, finalText.slice(0, 60));
        setLastTurn({ ms: turnMs, text: finalText.slice(0, 80) });

        return finalText;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setError(msg);
        return null;
      } finally {
        inFlight.current = false;
        setThinking(false);
      }
    },
    [persistCms],
  );

  const reset = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setLastRun(null);
    setLastTurn(null);
    setPendingDraft(null);
  }, []);

  const clearDraft = useCallback(() => setPendingDraft(null), []);

  const confirmDraft = useCallback(
    (
      extra?: { email?: string; phone?: string; nomad?: boolean; working?: boolean; tours?: string[] },
    ) => {
      if (!pendingDraft) return;
      const notes = [
        pendingDraft.notes,
        extra?.email ? `Email: ${extra.email}` : "",
        extra?.phone ? `Phone: ${extra.phone}` : "",
        extra?.nomad ? "Digital nomad" : "",
        extra?.working ? "Working while staying" : "",
        extra?.tours?.length ? `Tours of interest: ${extra.tours.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      confirmBookingDraft(
        { ...pendingDraft, notes, guestPhone: extra?.phone || pendingDraft.guestPhone },
        persistCms,
      );
      setPendingDraft(null);
    },
    [pendingDraft, persistCms],
  );

  return { messages, thinking, error, lastRun, lastTurn, send, reset, clearDraft, pendingDraft, confirmDraft };
}
