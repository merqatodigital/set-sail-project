import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
  MessageCircle,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { buildTalaSystemPrompt, talaGreeting } from "./talaPersona";
import { useTalaChat, getDevApiKey, setDevApiKey } from "./useTalaChat";
import { useTalaVoice } from "./useTalaVoice";
import { useSpeechInput } from "./useSpeechInput";
import { useTalaKnowledge } from "./useTalaKnowledge";
import { TALA_KOKORO_VOICES } from "./talaConfig";
import { setTalaOpenListener, openTala } from "./talaOpen";

// ---------------------------------------------------------------------------
// TALA — floating AI concierge widget. Sits above the WhatsApp float on the
// public site. Chat is powered by OpenRouter free models (via the tala-chat
// edge function); the voice is Kokoro-82M running in the visitor's browser.
// ---------------------------------------------------------------------------

const GREEN = "#1F3D2B";
const GREEN_DARK = "#16301F";
const GOLD = "#C6A15B";
const CREAM = "#FAF6EF";
const INK = "#26221C";

export function TalaWidget() {
  const { data } = useCms();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [devKey, setDevKeyState] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = useTalaChat();
  const voice = useTalaVoice({
    defaultVoiceId: data.settings.tala.voiceId || undefined,
    provider: data.settings.tala.voiceProvider,
    apiKey: data.settings.tala.apiKey || undefined,
    ttsModelId: data.settings.tala.ttsModelId || undefined,
    ttsVoiceId: data.settings.tala.ttsVoiceId || undefined,
    ignoreLocalVoice: true,
  });
  const knowledge = useTalaKnowledge();

  // Fallback to the human team — always points at the primary WhatsApp number
  // configured in Admin → WhatsApp. Shows as a persistent button and again
  // whenever TALA errors or can't finish the job.
  const waHref = buildWhatsAppLink(data.settings.whatsapp, data.settings.contact, {
    message: `Hi Marina Terrace! I was just chatting with TALA and need a hand: `,
  });
  const systemPrompt = useMemo(
    () => buildTalaSystemPrompt(data, knowledge.entries),
    [data, knowledge.entries],
  );
  const greeting = useMemo(() => talaGreeting(data), [data]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.thinking) return;
    setInput("");
    voice.stop();
    const reply = await chat.send(trimmed, systemPrompt, {
      model: data.settings.tala.modelId || undefined,
      adminApiKey: data.settings.tala.apiKey || undefined,
      cms: data,
    });
    if (reply) voice.speak(reply);
  };

  const openAndPrefill = useCallback(
    (message?: string) => {
      setOpen(true);
      if (message && message.trim()) {
        // Seed the input and send immediately so TALA responds to the intent.
        void submit(message);
      }
    },
    [submit],
  );

  // Let any public CTA open TALA with a prefilled intent via openTala().
  useEffect(() => {
    setTalaOpenListener(openAndPrefill);
    return () => setTalaOpenListener(null);
  }, [openAndPrefill]);

  const speech = useSpeechInput((finalText) => void submit(finalText));

  useEffect(() => {
    if (open) setDevKeyState(getDevApiKey());
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.thinking, open]);

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      voice.stop(); // barge-in: TALA goes quiet when the guest speaks
      speech.start();
    }
  };

  const voiceStatusLabel =
    voice.loadProgress !== null
      ? `Loading natural voice… ${voice.loadProgress}%`
      : voice.engine === "kokoro"
        ? "Natural voice ready"
        : voice.engine === "browser"
          ? "Standard voice (natural voice downloads in background)"
          : "";

  if (!data.settings.tala.enabled) return null;

  return (
    <>
      {/* Launcher — stacked above the WhatsApp float */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with TALA, your AI guide"
          className="group fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_6px_20px_rgba(31,61,43,0.45)] transition-all duration-200 hover:scale-110 active:scale-95 sm:bottom-24 sm:right-6 sm:h-14 sm:w-14"
          style={{ backgroundColor: GREEN }}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:animate-ping group-hover:opacity-60"
            style={{ backgroundColor: `${GREEN}66` }}
          />
          <Sparkles className="relative h-5 w-5 sm:h-6 sm:w-6" style={{ color: GOLD }} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border shadow-[0_18px_60px_rgba(38,34,28,0.35)] sm:bottom-6 sm:right-6"
          style={{ backgroundColor: CREAM, borderColor: `${GOLD}55`, height: "min(72vh, 600px)" }}
          role="dialog"
          aria-label="TALA chat"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${GOLD}33`, border: `1px solid ${GOLD}88` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg leading-none tracking-wide">TALA</p>
              <p className="mt-0.5 truncate text-[11px] text-white/70">
                Your friend in San Vicente
              </p>
            </div>
            <button
              onClick={() =>
                voice.enabled ? (voice.stop(), voice.setEnabled(false)) : voice.setEnabled(true)
              }
              aria-label={voice.enabled ? "Turn voice off" : "Turn voice on"}
              className="rounded-full p-2 transition-colors hover:bg-white/10"
              title={voice.enabled ? "Voice on" : "Voice off"}
            >
              {voice.enabled ? (
                <Volume2 className="h-4 w-4" style={{ color: GOLD }} />
              ) : (
                <VolumeX className="h-4 w-4 text-white/60" />
              )}
            </button>
            <button
              onClick={() => setShowSettings((s) => !s)}
              aria-label="TALA settings"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <Settings2 className="h-4 w-4 text-white/80" />
            </button>
            <button
              onClick={() => {
                voice.stop();
                setOpen(false);
              }}
              aria-label="Close TALA"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
          </div>

          {/* Voice status strip */}
          {voice.enabled && voiceStatusLabel && (
            <div
              className="flex items-center gap-2 px-4 py-1.5 text-[11px]"
              style={{ backgroundColor: `${GOLD}1A`, color: INK }}
            >
              {voice.loadProgress !== null && <Loader2 className="h-3 w-3 animate-spin" />}
              <span className="opacity-70">{voiceStatusLabel}</span>
            </div>
          )}

          {/* Settings */}
          {showSettings && (
            <div
              className="border-b px-4 py-3 text-xs"
              style={{ borderColor: `${GOLD}33`, color: INK }}
            >
              <label className="mb-1 block font-medium">Voice</label>
              {/* Read-only: TALA's voice is owner-controlled in Admin → TALA.
                  Visitors (including foreigners on their own devices) must NOT
                  be able to override it, so we show the active voice but don't
                  let them change it — the gear is a dev/diagnostic panel only. */}
              <div
                className="mb-3 w-full rounded-md border bg-white/60 px-2 py-1.5"
                style={{ borderColor: `${GOLD}55` }}
              >
                {TALA_KOKORO_VOICES.find((v) => v.id === voice.voiceId)?.label ?? voice.voiceId}
                <span className="ml-1 opacity-50">(set in Admin)</span>
              </div>
              <label className="mb-1 block font-medium">
                Dev OpenRouter key{" "}
                <span className="font-normal opacity-60">
                  (this device only — for building without the edge function)
                </span>
              </label>
              <input
                type="password"
                value={devKey}
                onChange={(e) => {
                  setDevKeyState(e.target.value);
                  setDevApiKey(e.target.value.trim());
                }}
                placeholder="sk-or-… (leave empty in production)"
                className="mb-3 w-full rounded-md border bg-white px-2 py-1.5"
                style={{ borderColor: `${GOLD}55` }}
              />
              <button
                onClick={() => {
                  voice.stop();
                  chat.reset();
                  setShowSettings(false);
                }}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-colors hover:bg-white"
                style={{ borderColor: `${GOLD}55` }}
              >
                <RotateCcw className="h-3 w-3" /> Clear conversation
              </button>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <Bubble role="assistant" text={greeting} />
            {chat.messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.content} />
            ))}
            {chat.thinking && (
              <div className="flex items-center gap-2 text-xs" style={{ color: `${INK}99` }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: GOLD }} />
                TALA is thinking…
              </div>
            )}
            {chat.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {chat.error}
              </p>
            )}

            {/* Guest booking verification + visitor details form — TALA
                drafted it; the guest fills the few missing bits and confirms. */}
            {chat.pendingDraft && (
              <BookingFormCard
                draft={chat.pendingDraft}
                tours={(data.operations?.tours ?? []).map((t) => ({ name: t.name }))}
                onConfirm={(extra) => chat.confirmDraft(extra)}
                onEdit={() => chat.clearDraft()}
              />
            )}

            {/* Fallback to a human — always available, and the safety net when
                TALA can't finish the job. */}
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors hover:bg-white"
              style={{ borderColor: "#25D36688", color: "#1F7A3D", backgroundColor: "#25D36614" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {chat.error ? "TALA hit a snag — message us on WhatsApp" : "Prefer a human? Message us on WhatsApp"}
            </a>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
            className="flex items-center gap-2 border-t px-3 py-3"
            style={{ borderColor: `${GOLD}33`, backgroundColor: "#FFFFFF" }}
          >
            {speech.supported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={speech.listening ? "Stop listening" : "Speak to TALA"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95"
                style={{ backgroundColor: speech.listening ? "#B4433A" : GREEN }}
              >
                {speech.listening ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
            <input
              ref={inputRef}
              value={speech.listening ? speech.transcript : input}
              onChange={(e) => setInput(e.target.value)}
              readOnly={speech.listening}
              placeholder={speech.listening ? "Listening…" : "Ask TALA anything…"}
              className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: `${GOLD}55`, color: INK }}
            />
            <button
              type="submit"
              disabled={chat.thinking || (!input.trim() && !speech.listening)}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: GREEN }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm"
        style={
          isUser
            ? { backgroundColor: GREEN, color: "#FFFFFF", borderBottomRightRadius: 6 }
            : {
                backgroundColor: "#FFFFFF",
                color: INK,
                border: `1px solid ${GOLD}33`,
                borderBottomLeftRadius: 6,
              }
        }
      >
        {text}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visitor booking form — shown after TALA drafts a booking. TALA already
// knows name/room/dates; this lets the guest refine guests, add their email,
// and tell us about their stay (nomad? working? tours?) before the human
// team sees it. Confirm = the guest's human action; we never auto-write.
// ---------------------------------------------------------------------------
type DraftExtra = { email?: string; nomad?: boolean; working?: boolean; tours?: string[] };

function BookingFormCard({
  draft,
  tours,
  onConfirm,
  onEdit,
}: {
  draft: {
    id: string;
    reference: string;
    guestName: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    amount: number;
    notes: string;
  };
  tours: { name: string }[];
  onConfirm: (extra: DraftExtra) => void;
  onEdit: () => void;
}) {
  const [email, setEmail] = useState(draft.notes.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? "");
  const [guests, setGuests] = useState(Math.max(1, draft.guests || 1));
  const [nomad, setNomad] = useState(false);
  const [working, setWorking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const toggleTour = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));

  const nights =
    Math.max(
      0,
      Math.round(
        (new Date(draft.checkOut).getTime() - new Date(draft.checkIn).getTime()) / 86400000,
      ),
    ) || 1;

  return (
    <div
      className="mx-1 rounded-xl border-2 px-3.5 py-3"
      style={{ borderColor: GOLD, backgroundColor: "#FFFFFF", color: INK }}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
        <Sparkles className="h-3.5 w-3.5" /> Your booking — please confirm
      </p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2"><dt className="opacity-60">Name</dt><dd className="font-medium text-right">{draft.guestName}</dd></div>
        <div className="flex justify-between gap-2"><dt className="opacity-60">Room / Plan</dt><dd className="font-medium text-right">{draft.roomType}</dd></div>
        <div className="flex justify-between gap-2"><dt className="opacity-60">Check-in</dt><dd className="font-medium">{draft.checkIn}</dd></div>
        <div className="flex justify-between gap-2"><dt className="opacity-60">Check-out</dt><dd className="font-medium">{draft.checkOut}</dd></div>
        <div className="flex justify-between gap-2"><dt className="opacity-60">Nights</dt><dd className="font-medium">{nights}</dd></div>
      </dl>

      <div className="mt-3 space-y-2.5">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="opacity-70">Guests</span>
          <input
            type="number"
            min={1}
            max={10}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-md border px-2 py-1 text-right text-sm"
            style={{ borderColor: `${GOLD}55` }}
          />
        </label>
        <label className="block text-sm">
          <span className="opacity-70">Email (so we can confirm)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: `${GOLD}55` }}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNomad((v) => !v)}
            className="flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors"
            style={
              nomad
                ? { backgroundColor: GREEN, color: "#fff" }
                : { border: `1px solid ${GOLD}55`, color: INK }
            }
          >
            Digital nomad
          </button>
          <button
            type="button"
            onClick={() => setWorking((v) => !v)}
            className="flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors"
            style={
              working
                ? { backgroundColor: GREEN, color: "#fff" }
                : { border: `1px solid ${GOLD}55`, color: INK }
            }
          >
            Working here
          </button>
        </div>

        {tours.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] opacity-70">Tours you might like (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {tours.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => toggleTour(t.name)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                  style={
                    picked.includes(t.name)
                      ? { backgroundColor: GOLD, color: "#fff" }
                      : { border: `1px solid ${GOLD}55`, color: INK }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] opacity-60">Pending — the team confirms after you submit.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm({ email: email.trim() || undefined, nomad, working, tours: picked })}
          className="flex-1 rounded-full py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: GREEN }}
        >
          Confirm booking
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5"
          style={{ borderColor: `${GOLD}55` }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
