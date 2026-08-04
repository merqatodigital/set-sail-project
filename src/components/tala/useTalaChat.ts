import { useCallback, useRef, useState } from "react";
import {
  TALA_CHAT_ENDPOINT,
  TALA_MAX_HISTORY,
  TALA_STORAGE,
  type TalaMessage,
} from "./talaConfig";
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

interface WireMessage {
  role: "user" | "assistant";
  content: string;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @deprecated OpenRouter keys are now accepted only by the private Hermes service. */
export function getDevApiKey(): string {
  return "";
}

/** @deprecated Browser storage of model credentials is intentionally disabled. */
export function setDevApiKey(_key: string) {
  try {
    localStorage.removeItem(TALA_STORAGE.devApiKey);
  } catch {
    // Storage may be unavailable in private mode.
  }
}

function getTalaSessionKey(): string {
  const storageKey = "tala.hermesSession";
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = `guest:${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `guest:${crypto.randomUUID()}`;
  }
}

/** The browser talks only to the same-origin server; Hermes is the sole agent. */
async function askHermes(messages: WireMessage[]): Promise<string> {
  const res = await fetch(TALA_CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TALA-Session": getTalaSessionKey(),
    },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
  if (!reply) throw new Error("TALA returned an empty reply.");
  return reply;
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

      void systemPrompt;
      const wire: WireMessage[] = history
        .slice(-TALA_MAX_HISTORY)
        .map((message) => ({ role: message.role, content: message.content }));
      const sentiment = detectSentiment(trimmed);

      try {
        // Hermes is the driver. Tool calls, memory, skills, and OpenRouter
        // execution all complete inside the private Hermes service.
        const toolsUsed: string[] = [];
        const finalText = await askHermes(wire);
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

  return { messages, thinking, error, lastRun, send, reset, clearDraft, pendingDraft, confirmDraft };
}
