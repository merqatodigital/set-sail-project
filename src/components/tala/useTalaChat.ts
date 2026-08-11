import { useCallback, useRef, useState } from "react";
import { TALA_STORAGE, type TalaMessage } from "./talaConfig";
import { captureGuestLead, confirmBookingDraft } from "./talaTools";
import {
  classifyHeuristically,
  writeAuditEntry,
  type TalaClassification,
} from "./talaGraph";
import { detectSentiment } from "./talaSentiment";
import { useCms } from "@/context/CmsContext";
import type { CmsData } from "@/types/cms";
import { talaChat, talaOwnerToken, talaOwnerUserId } from "@/lib/talaClient";

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
 * we mint a random id stored in localStorage and reuse it for the chat session.
 * This isolates each visitor's Durable Object conversation from every other
 * visitor while still giving TALA memory across turns in this browser.
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
 * THE single TALA path.
 *
 * The browser sends only the guest's newest utterance plus identity. The
 * Cloudflare TallaAgent owns conversation history, the authoritative system
 * prompt, hard-coded Marina Terrace memory, live D1 context and all tools.
 *
 * This is intentionally different from the old frontend path: we do NOT build
 * a second system prompt, inject weather/sentiment instructions, replay browser
 * history or execute a second tool loop. That duplicated work was discarded by
 * the Worker anyway and added avoidable latency.
 */
async function askCloudflareAgent(
  text: string,
  preferredModel?: string,
  owner?: boolean,
  onDelta?: (delta: string, accumulated: string) => void,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty message.");

  let authToken: string | undefined;
  let userId = getGuestSessionId();
  if (owner) {
    const [token, ownerId] = await Promise.all([talaOwnerToken(), talaOwnerUserId()]);
    authToken = token || undefined;
    if (ownerId) userId = ownerId;
  }

  const result = await talaChat({
    message: trimmed,
    role: owner ? "owner" : "guest",
    userId,
    model: preferredModel,
    authToken,
    onDelta,
  });
  const content = result.content?.trim() || "";
  if (!content) throw new Error("TALA returned an empty reply.");
  return content;
}

/**
 * Workspace Day Pass — a structured, single-purpose request sent to the SAME
 * Cloudflare TallaAgent used by chat. The worker resolves it through
 * requestRoomBooking (roomType "Day Pass", checkIn = the chosen day, checkOut =
 * the next day, guests 1), hard-enforces required fields server-side, dedupes
 * a pending request and persists one authoritative booking-request row.
 */
export interface RequestDayPassInput {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  day: string; // ISO YYYY-MM-DD
  guests?: number;
  notes?: string;
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

  const content = await askCloudflareAgent(text, preferredModel);
  const match = content.match(/\bMT-\d{8}-\d{4}\b/);
  return { content, reference: match ? match[0] : null };
}

/** Deterministic local telemetry only — never adds another LLM call. */
export interface TalaRunInfo {
  classification: TalaClassification;
  toolsUsed: string[];
}

export interface UseTalaChat {
  messages: TalaMessage[];
  thinking: boolean;
  error: string | null;
  pendingDraft: BookingDraft | null;
  lastRun: TalaRunInfo | null;
  /** Device-measured send → completed reply latency. */
  lastTurn: { ms: number; text: string } | null;
  send: (
    text: string,
    systemPrompt: string,
    options?: {
      model?: string;
      adminApiKey?: string;
      cms?: CmsData;
      owner?: boolean;
    },
  ) => Promise<string | null>;
  confirmDraft: (
    extra?: { email?: string; nomad?: boolean; working?: boolean; tours?: string[] },
  ) => void;
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
  const { update: persistCms } = useCms();
  const messagesRef = useRef<TalaMessage[]>([]);

  const send = useCallback(
    async (
      text: string,
      _systemPrompt: string,
      options?: { model?: string; adminApiKey?: string; cms?: CmsData; owner?: boolean },
    ): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed || inFlight.current) return null;

      inFlight.current = true;
      setError(null);
      setThinking(true);
      const turnStart = performance.now();
      const preferredModel = options?.model;
      const sentiment = detectSentiment(trimmed);

      const userMsg: TalaMessage = { id: newId(), role: "user", content: trimmed };
      messagesRef.current = [...messagesRef.current, userMsg];
      setMessages([...messagesRef.current]);

      // Lead capture is intentionally fire-and-forget and never blocks TALA.
      if (!options?.owner) {
        void captureGuestLead(trimmed, options?.cms?.settings?.siteName || "guest");
      }

      // Reserve one assistant message and update it in-place as SSE deltas land.
      // The guest sees TALA typing immediately instead of waiting for the full
      // completion. Durable Object history remains the authoritative memory.
      const assistantId = newId();
      let streamed = false;
      let rafId: number | null = null;
      let pendingAccumulated = "";

      const flushStream = () => {
        rafId = null;
        if (!pendingAccumulated) return;
        streamed = true;
        const nextAssistant: TalaMessage = {
          id: assistantId,
          role: "assistant",
          content: pendingAccumulated,
        };
        const withoutPartial = messagesRef.current.filter((m) => m.id !== assistantId);
        messagesRef.current = [...withoutPartial, nextAssistant];
        setMessages([...messagesRef.current]);
      };

      const onDelta = (_delta: string, accumulated: string) => {
        pendingAccumulated = accumulated;
        if (rafId !== null) return;
        if (typeof requestAnimationFrame === "function") {
          rafId = requestAnimationFrame(flushStream);
        } else {
          flushStream();
        }
      };

      try {
        const finalText = await askCloudflareAgent(
          trimmed,
          preferredModel,
          options?.owner,
          onDelta,
        );

        if (rafId !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        pendingAccumulated = finalText;
        flushStream();

        // Guarantee exactly one final assistant message even if the server or
        // browser did not expose incremental chunks for this particular turn.
        if (!streamed) {
          const nextAssistant: TalaMessage = {
            id: assistantId,
            role: "assistant",
            content: finalText,
          };
          messagesRef.current = [...messagesRef.current, nextAssistant];
          setMessages([...messagesRef.current]);
        }

        const classification = classifyHeuristically(trimmed);
        const toolsUsed: string[] = []; // authoritative tools execute server-side
        setLastRun({ classification, toolsUsed });
        writeAuditEntry({
          classification,
          guestMessage: trimmed,
          replyPreview: finalText,
          toolsUsed,
          sentiment: sentiment.sentiment,
        });

        const turnMs = Math.round(performance.now() - turnStart);
        console.debug(`[TALA] completed reply in ${turnMs}ms`, finalText.slice(0, 60));
        setLastTurn({ ms: turnMs, text: finalText.slice(0, 80) });
        return finalText;
      } catch (e) {
        if (rafId !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(rafId);
        }
        // Do not leave a half answer in history after a failed/aborted stream.
        messagesRef.current = messagesRef.current.filter((m) => m.id !== assistantId);
        setMessages([...messagesRef.current]);
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setError(msg);
        return null;
      } finally {
        inFlight.current = false;
        setThinking(false);
      }
    },
    [],
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

  return {
    messages,
    thinking,
    error,
    lastRun,
    lastTurn,
    send,
    reset,
    clearDraft,
    pendingDraft,
    confirmDraft,
  };
}
