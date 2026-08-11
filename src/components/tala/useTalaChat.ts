import { useCallback, useRef, useState } from "react";
import { TALA_STORAGE, type TalaMessage } from "./talaConfig";
import {
  captureGuestLead,
  confirmBookingDraft,
} from "./talaTools";
import {
  classifyHeuristically,
  writeAuditEntry,
  type TalaClassification,
} from "./talaGraph";
import { detectSentiment } from "./talaSentiment";
import { useCms } from "@/context/CmsContext";
import type { CmsData } from "@/types/cms";
import { talaChat, talaChatStream, talaOwnerToken, talaOwnerUserId } from "@/lib/talaClient";

interface AssistantReply {
  content: string | null;
  timing?: Record<string, number | string>;
}

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
 * The Worker runs the full prompt build + LLM + tool loop server-side, so the
 * browser sends ONLY the guest's text and renders what streams back. There is
 * no browser-side prompt, tool loop, or context injection. For owner mode we
 * forward the existing Supabase access token; the Worker — not the `role`
 * field — decides whether the caller actually gets owner privileges.
 *
 * When `onDelta` is provided the Worker's SSE endpoint is used so text appears
 * as it is generated; otherwise a single buffered call is made.
 */
async function askCloudflareAgent(
  text: string,
  opts?: {
    model?: string;
    owner?: boolean;
    signal?: AbortSignal;
    onDelta?: (delta: string) => void;
  },
): Promise<AssistantReply> {
  if (!text.trim()) throw new Error("Empty message.");
  let authToken: string | undefined;
  let userId = getGuestSessionId();
  if (opts?.owner) {
    const [token, ownerId] = await Promise.all([talaOwnerToken(), talaOwnerUserId()]);
    authToken = token || undefined;
    if (ownerId) userId = ownerId;
  }
  const payload = {
    message: text,
    role: (opts?.owner ? "owner" : "guest") as "owner" | "guest",
    userId,
    model: opts?.model,
    authToken,
    signal: opts?.signal,
  };
  const result = opts?.onDelta
    ? await talaChatStream(payload, opts.onDelta)
    : await talaChat(payload);
  const content = result.content?.trim() || "";
  if (!content) throw new Error("TALA returned an empty reply.");
  return { content, timing: result.timing };
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
  const reply = await askCloudflareAgent(text, { model: preferredModel });
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
  // Live stream of the current turn — aborted when a new turn starts or the
  // conversation resets, so a stale reply can never overwrite a newer one.
  const abortRef = useRef<AbortController | null>(null);
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

      // Local (network-free) sentiment — kept ONLY for the audit entry below.
      // It is never injected into a prompt: the Worker owns the prompt.
      const sentiment = detectSentiment(trimmed);

      // Cancel any still-open stream from a previous turn.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // ONE brain: guest and owner turns both stream from the Cloudflare
        // TallaAgent. No browser prompt build, no browser tool loop, no
        // weather/time/sentiment injection, no direct browser->OpenRouter call
        // and no Supabase tala-chat edge function. Owner privileges are
        // verified by the Worker from the forwarded Supabase bearer token.
        const assistantId = newId();
        let streamed = "";
        let firstTokenMs: number | null = null;

        const reply = await askCloudflareAgent(trimmed, {
          model: preferredModel,
          owner: options?.owner,
          signal: controller.signal,
          onDelta: (delta) => {
            if (firstTokenMs === null) {
              firstTokenMs = Math.round(performance.now() - turnStart);
              // First visible token — drop the thinking indicator immediately.
              setThinking(false);
              messagesRef.current = [
                ...messagesRef.current,
                { id: assistantId, role: "assistant", content: "" },
              ];
            }
            streamed += delta;
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === assistantId ? { ...m, content: streamed } : m,
            );
            setMessages(messagesRef.current);
          },
        });

        const finalText = reply.content?.trim();
        if (!finalText) throw new Error("TALA didn't have a reply.");

        // Reconcile the streamed placeholder with the Worker's final text
        // (identical in the normal case; the Worker sanitizes the final copy).
        const hasPlaceholder = messagesRef.current.some((m) => m.id === assistantId);
        messagesRef.current = hasPlaceholder
          ? messagesRef.current.map((m) => (m.id === assistantId ? { ...m, content: finalText } : m))
          : [...messagesRef.current, { id: newId(), role: "assistant", content: finalText }];
        setMessages(messagesRef.current);

        const toolsUsed: string[] = [];

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
        // Latency telemetry — no internal reasoning, only timings.
        console.debug(
          `[TALA] first token ${firstTokenMs ?? "n/a"}ms · complete ${turnMs}ms`,
          reply.timing
            ? `worker prompt ${reply.timing.promptMs ?? "?"}ms · llm ${reply.timing.llmMs ?? "?"}ms · tools ${reply.timing.toolMs ?? "?"}ms · total ${reply.timing.totalMs ?? "?"}ms`
            : "",
        );
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
    abortRef.current?.abort();
    abortRef.current = null;
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
