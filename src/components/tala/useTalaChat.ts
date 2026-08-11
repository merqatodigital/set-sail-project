import { useCallback, useRef, useState } from "react";
import {
  TALA_MAX_HISTORY,
  TALA_STORAGE,
  type TalaMessage,
} from "./talaConfig";
import {
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
import { talaChat, talaOwnerToken, talaOwnerUserId } from "@/lib/talaClient";

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
 * THE single TALA path — every surface (guest text, voice transcript, CTA
 * intent, Day Pass, owner Ask TALA) goes through the centralized Cloudflare
 * client in src/lib/talaClient.ts:
 *
 *   browser -> ${VITE_TALA_WORKER_URL}/api/talla/chat -> TallaAgent DO -> tools
 *
 * The Worker runs the full LLM + tool loop server-side and returns only the
 * final text, so no tool_calls come back to the browser. For owner mode we
 * forward the existing Supabase access token; the Worker — not the `role`
 * field — decides whether the caller actually gets owner privileges.
 */
async function askCloudflareAgent(
  messages: WireMessage[],
  preferredModel?: string,
  owner?: boolean,
): Promise<AssistantReply> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content || "";
  if (!text.trim()) throw new Error("Empty message.");
  let authToken: string | undefined;
  let userId = getGuestSessionId();
  if (owner) {
    const [token, ownerId] = await Promise.all([talaOwnerToken(), talaOwnerUserId()]);
    authToken = token || undefined;
    if (ownerId) userId = ownerId;
  }
  const result = await talaChat({
    message: text,
    role: owner ? "owner" : "guest",
    userId,
    model: preferredModel,
    authToken,
  });
  const content = result.content?.trim() || "";
  if (!content) throw new Error("TALA returned an empty reply.");
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
        // ONE brain: guest and owner turns both go to the Cloudflare
        // TallaAgent. No direct browser->OpenRouter call, no Supabase
        // tala-chat edge function. Owner privileges are verified by the
        // Worker from the forwarded Supabase bearer token.
        const requestReply = async (msgs: WireMessage[]): Promise<AssistantReply> =>
          askCloudflareAgent(msgs, preferredModel, options?.owner);

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
