import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  X,
  MessageCircle,
  Bell,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { buildTalaSystemPrompt, talaGreeting } from "./talaPersona";
import { useTalaChat, getDevApiKey, setDevApiKey } from "./useTalaChat";
import { useTalaVoice } from "./useTalaVoice";
import { setTalaOpenListener } from "./talaOpen";
import {
  normalizeIntent,
  intentMessage,
  intentOfferLabel,
  intentOfferKind,
  type TalaIntentPayload,
} from "./talaIntent";
import { DayPassForm } from "./DayPassForm";
import { BookingRequestForm } from "./BookingRequestForm";
import { detectBookingIntent } from "./talaOffers";
import { markProactiveRead, type ProactiveMessage } from "./talaProactive";

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
  const [proactiveMessages, setProactiveMessages] = useState<ProactiveMessage[]>([]);
  const [showProactive, setShowProactive] = useState(false);
  const [intent, setIntent] = useState<TalaIntentPayload | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = useTalaChat();
  const voice = useTalaVoice({ active: false });

  const waHref = buildWhatsAppLink(data.settings.whatsapp, data.settings.contact, {
    message: `Hi Marina Terrace! I was just chatting with TALA and need a hand: `,
  });
  const systemPrompt = useMemo(() => buildTalaSystemPrompt(data), [data]);
  const greeting = useMemo(() => talaGreeting(data), [data]);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chat.thinking) return;
      setInput("");

      const escalated = detectBookingIntent(trimmed, data);
      if (escalated) setIntent(escalated);

      await chat.send(trimmed, systemPrompt, {
        model: data.settings.tala.modelId || undefined,
        cms: data,
      });
    },
    [chat, data, systemPrompt],
  );

  const openAndPrefill = useCallback(
    (message?: string, intentPayload?: TalaIntentPayload | null) => {
      setOpen(true);
      const normalized =
        normalizeIntent(intentPayload ?? undefined) ?? (message ? normalizeIntent(message) : null);
      if (
        normalized &&
        (normalized.kind === "workspace_day_pass" ||
          normalized.kind === "room_booking" ||
          normalized.kind === "package_booking")
      ) {
        setIntent(normalized);
        setShowSettings(false);
        return;
      }
      setIntent(null);
      const text = normalized
        ? intentMessage({ ...normalized, message: message ?? normalized.message })
        : message;
      if (text && text.trim()) void submit(text);
    },
    [submit],
  );

  useEffect(() => {
    setTalaOpenListener(openAndPrefill);
    return () => setTalaOpenListener(null);
  }, [openAndPrefill]);

  useEffect(() => {
    if (open) setDevKeyState(getDevApiKey());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setProactiveMessages([]);
    setShowProactive(false);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.thinking, open]);

  if (!data.settings.tala.enabled) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with TALA"
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

      {open && (
        <div
          className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border shadow-[0_18px_60px_rgba(38,34,28,0.35)] sm:bottom-6 sm:right-6"
          style={{ backgroundColor: CREAM, borderColor: `${GOLD}55`, height: "min(72vh, 600px)" }}
          role="dialog"
          aria-label="TALA chat"
        >
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
              onClick={() => setShowSettings((s) => !s)}
              aria-label="TALA settings"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <Settings2 className="h-4 w-4 text-white/80" />
            </button>
            <button
              onClick={() => {
                setIntent(null);
                setOpen(false);
              }}
              aria-label="Close TALA"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
          </div>

          {showSettings && (
            <div
              className="border-b px-4 py-3 text-xs"
              style={{ borderColor: `${GOLD}33`, color: INK }}
            >
              <label className="mb-1 block font-medium">
                Dev OpenRouter key{" "}
                <span className="font-normal opacity-60">(this device only)</span>
              </label>
              <input
                type="password"
                value={devKey}
                onChange={(e) => {
                  setDevKeyState(e.target.value);
                  setDevApiKey(e.target.value.trim());
                }}
                placeholder="sk-or-…"
                className="mb-3 w-full rounded-md border bg-white px-2 py-1.5"
                style={{ borderColor: `${GOLD}55` }}
              />
              <div
                className="mb-3 rounded-md border px-2.5 py-2"
                style={{ borderColor: `${GOLD}33`, backgroundColor: `${GOLD}08` }}
              >
                <p className="mb-1 font-medium">Latency</p>
                <dl className="space-y-1 text-[11px] opacity-80">
                  <div className="flex justify-between">
                    <dt>TALA reply</dt>
                    <dd className="font-mono">{chat.lastTurn ? `${chat.lastTurn.ms} ms` : "—"}</dd>
                  </div>
                </dl>
              </div>
              <button
                onClick={() => {
                  chat.reset();
                  setIntent(null);
                  setShowSettings(false);
                }}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-colors hover:bg-white"
                style={{ borderColor: `${GOLD}55` }}
              >
                <RotateCcw className="h-3 w-3" /> Clear conversation
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {intent?.kind === "workspace_day_pass" ? (
              <DayPassForm cms={data} />
            ) : intent && (intent.kind === "room_booking" || intent.kind === "package_booking") ? (
              <BookingRequestForm
                cms={data}
                intent={intent}
                offerLabel={intentOfferLabel(intent)}
                offerKind={intentOfferKind(intent)}
              />
            ) : (
              <Bubble role="assistant" text={greeting} />
            )}

            {showProactive && proactiveMessages.length > 0 && (
              <div className="space-y-2">
                <div
                  className="flex items-center gap-1.5 text-[11px] font-medium"
                  style={{ color: GOLD }}
                >
                  <Bell className="h-3 w-3" />
                  <span>Updates for you</span>
                </div>
                {proactiveMessages.slice(0, 3).map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      void submit(msg.message);
                      void markProactiveRead(msg.id);
                      setShowProactive(false);
                    }}
                    className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-white/80"
                    style={{ borderColor: `${GOLD}33`, backgroundColor: `${GOLD}08` }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: INK }}>
                      {msg.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: `${INK}99` }}>
                      {msg.message.slice(0, 100)}…
                    </p>
                  </button>
                ))}
              </div>
            )}

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

            {chat.pendingDraft && (
              <BookingFormCard
                draft={chat.pendingDraft}
                tours={(data.operations?.tours ?? []).map((t) => ({ name: t.name }))}
                onConfirm={(extra) => chat.confirmDraft(extra)}
                onEdit={() => chat.clearDraft()}
              />
            )}

            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors hover:bg-white"
              style={{ borderColor: "#25D36688", color: "#1F7A3D", backgroundColor: "#25D36614" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {chat.error
                ? "TALA hit a snag — message us on WhatsApp"
                : "Prefer a human? Message us on WhatsApp"}
            </a>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
            className="flex items-center gap-2 border-t px-3 py-3"
            style={{ borderColor: `${GOLD}33`, backgroundColor: "#FFFFFF" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask TALA anything…"
              className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: `${GOLD}55`, color: INK }}
            />
            <button
              type="submit"
              disabled={chat.thinking || !input.trim()}
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

type DraftExtra = {
  email?: string;
  phone?: string;
  nomad?: boolean;
  working?: boolean;
  tours?: string[];
};

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
    guestPhone: string;
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
  const [email, setEmail] = useState(
    draft.notes.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? "",
  );
  const [phone, setPhone] = useState(draft.guestPhone || "");
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
      <p
        className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: GOLD }}
      >
        <Sparkles className="h-3.5 w-3.5" /> Your booking — please confirm
      </p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="opacity-60">Name</dt>
          <dd className="font-medium text-right">{draft.guestName}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="opacity-60">Room / Plan</dt>
          <dd className="font-medium text-right">{draft.roomType}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="opacity-60">Check-in</dt>
          <dd className="font-medium">{draft.checkIn}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="opacity-60">Check-out</dt>
          <dd className="font-medium">{draft.checkOut}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="opacity-60">Nights</dt>
          <dd className="font-medium">{nights}</dd>
        </div>
      </dl>
      <div className="mt-3 space-y-2.5">
        <label className="block text-sm">
          <span className="opacity-70">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: `${GOLD}55` }}
          />
        </label>
        <label className="block text-sm">
          <span className="opacity-70">WhatsApp / Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: `${GOLD}55` }}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNomad((v) => !v)}
            className="flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium"
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
            className="flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium"
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
            <p className="mb-1 text-[11px] opacity-70">Tours you might like</p>
            <div className="flex flex-wrap gap-1.5">
              {tours.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => toggleTour(t.name)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
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
          onClick={() =>
            onConfirm({
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
              nomad,
              working,
              tours: picked,
            })
          }
          className="flex-1 rounded-full py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: GREEN }}
        >
          Confirm booking
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border px-3 py-2 text-xs font-medium"
          style={{ borderColor: `${GOLD}55` }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
