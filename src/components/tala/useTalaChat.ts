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
  parseClassification,
  writeAuditEntry,
  TALA_CLASSIFY_PROMPT,
  type TalaClassification,
} from "./talaGraph";
import { useCms } from "@/context/CmsContext";
import type { CmsData } from "@/types/cms";

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
 * Classify node of the agent graph — one cheap, tool-free LLM call tagging
 * intent / department / urgency (KAPWA's classify node, ported). Runs in
 * parallel with the main answer so it adds no latency; any failure falls
 * back to deterministic keyword rules so it can never block a reply.
 */
async function classifyMessage(
  userText: string,
  apiKey: string,
  preferredModel?: string,
): Promise<TalaClassification> {
  const wire: WireMessage[] = [
    { role: "system", content: TALA_CLASSIFY_PROMPT },
    { role: "user", content: userText },
  ];
  const chain = preferredModel
    ? [preferredModel, ...TALA_FREE_MODELS.filter((m) => m !== preferredModel)]
    : [...TALA_FREE_MODELS];
  for (const model of chain.slice(0, 2)) {
    try {
      const result = await requestChatCompletion(model, wire, apiKey, false);
      if (result.ok) {
        const parsed = parseClassification(result.message.content);
        if (parsed) return parsed;
      }
    } catch {
      /* fall through to next model / heuristics */
    }
  }
  return classifyHeuristically(userText);
}

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

      try {
        // Priority: key entered in Admin → TALA (works instantly, no deploy
        // needed) → device-local dev key (building on this browser only) →
        // Supabase edge function (production path, key stays server-side).
        const key = options?.adminApiKey || getDevApiKey();
        const requestReply = (msgs: WireMessage[]) =>
          key
            ? askOpenRouterDirect(msgs, key, preferredModel)
            : askEdgeFunction(msgs, preferredModel);

        // Graph node 1 — classify. Fired in parallel with the answer so it
        // costs no latency; only used for audit + admin telemetry. On the
        // edge-function path (no browser key) skip the extra call and use
        // the deterministic keyword rules directly.
        const classifyPromise: Promise<TalaClassification> = key
          ? classifyMessage(trimmed, key, preferredModel).catch(() =>
              classifyHeuristically(trimmed),
            )
          : Promise.resolve(classifyHeuristically(trimmed));

        // Graph node 2 — agent: the tool-calling loop.
        const toolsUsed: string[] = [];
        let reply = await requestReply(wire);
        let hops = 0;
        while (reply.tool_calls?.length && hops < MAX_TOOL_HOPS) {
          hops++;
          wire = [
            ...wire,
            { role: "assistant", content: reply.content, tool_calls: reply.tool_calls },
          ];
          for (const call of reply.tool_calls) {
            toolsUsed.push(call.function.name);
            const result = options?.cms
              ? await executeTalaTool(
                  { id: call.id, name: call.function.name, arguments: call.function.arguments },
                  {
                    cms: options.cms,
                    update: options.owner ? persistCms : undefined,
                    owner: !!options.owner,
                  } satisfies TalaToolContext,
                )
              : { error: "Tool unavailable — no site data loaded." };
            // Surface a guest booking draft so the widget can show a confirm card.
            const draft = (result as { draft?: BookingDraft }).draft;
            if (draft) setPendingDraft(draft);
            wire.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
          }
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
        const classification = await classifyPromise;
        setLastRun({ classification, toolsUsed });
        writeAuditEntry({
          classification,
          guestMessage: trimmed,
          replyPreview: finalText,
          toolsUsed,
        });

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
    setPendingDraft(null);
  }, []);

  const clearDraft = useCallback(() => setPendingDraft(null), []);

  const confirmDraft = useCallback(
    (
      extra?: { email?: string; nomad?: boolean; working?: boolean; tours?: string[] },
    ) => {
      if (!pendingDraft) return;
      const notes = [
        pendingDraft.notes,
        extra?.email ? `Email: ${extra.email}` : "",
        extra?.nomad ? "Digital nomad" : "",
        extra?.working ? "Working while staying" : "",
        extra?.tours?.length ? `Tours of interest: ${extra.tours.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      confirmBookingDraft(
        { ...pendingDraft, notes },
        persistCms,
      );
      setPendingDraft(null);
    },
    [pendingDraft, persistCms],
  );

  return { messages, thinking, error, lastRun, send, reset, clearDraft, pendingDraft, confirmDraft };
}
