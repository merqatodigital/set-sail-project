import { useCallback, useEffect, useRef, useState } from "react";
import {
  OPENROUTER_TTS_ENDPOINT,
  TALA_DEFAULT_VOICE,
  TALA_KOKORO_MODEL,
  TALA_STORAGE,
} from "./talaConfig";

async function synthesizeOpenRouterTts(
  text: string,
  config: { apiKey: string; model: string; voice: string },
): Promise<Blob> {
  const res = await fetch(OPENROUTER_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "TALA - San Vicente Concierge",
    },
    body: JSON.stringify({ model: config.model, input: text, voice: config.voice, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
}

type KokoroRawAudio = { audio: Float32Array; sampling_rate: number };
type KokoroInstance = { generate: (text: string, options: { voice: string }) => Promise<KokoroRawAudio> };

function encodePCM16Wav(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function normalizeForSpeech(text: string): string {
  return text
    .replace(/(?:PHP|₱)\s?([\d,]+(?:\.\d+)?)/gi, "$1 pesos")
    .replace(/\bPHP\b/g, "pesos")
    .replace(/\$\s?([\d,]+(?:\.\d+)?)/g, "$1 dollars")
    .replace(/\b(\d+)\s?Mbps\b/gi, "$1 megabits per second")
    .replace(/\b(\d+)\s?Gbps\b/gi, "$1 gigabits per second")
    .replace(/\b(\d+)\s?(?:sqm|m²)\b/gi, "$1 square meters")
    .replace(/\b24\/7\b/g, "twenty-four seven")
    .replace(/https?:\/\/wa\.me\/\S+/gi, "our WhatsApp")
    .replace(/https?:\/\/\S+/gi, "our website")
    .replace(/\bwww\.\S+/gi, "our website")
    .replace(/\be\.g\.\s?/gi, "for example, ")
    .replace(/\betc\.?\b/gi, "and so on")
    .replace(/\bvs\.?\b/gi, "versus")
    .replace(/\s[—–]\s?/g, ", ")
    .replace(/&/g, " and ")
    .replace(/\s?\/\s?/g, " or ");
}

function splitSentences(text: string): string[] {
  const cleaned = normalizeForSpeech(text).replace(/[*_#`~>]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((p) => p.trim()).filter(Boolean) ?? [cleaned];
}

function pickBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const preferred = ["samantha", "aria", "jenny", "libby", "sonia", "natasha", "zira", "google us english", "female"];
  for (const name of preferred) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(name));
    if (hit) return hit;
  }
  return pool[0] ?? null;
}

export type TalaVoiceEngine = "kokoro" | "openrouter" | "browser" | "none";
export type TalaVoiceStatus = "idle" | "loading" | "speaking";

export interface UseTalaVoice {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  engine: TalaVoiceEngine;
  status: TalaVoiceStatus;
  loadProgress: number | null;
  lastTtsMs: number | null;
  voiceId: string;
  setVoiceId: (id: string) => void;
  speak: (text: string) => void;
  enqueue: (text: string) => void;
  stop: () => void;
  preview: (id: string, text?: string) => void;
  previewId: string | null;
}

export interface UseTalaVoiceOptions {
  defaultVoiceId?: string;
  provider?: "kokoro" | "openrouter";
  apiKey?: string;
  ttsModelId?: string;
  ttsVoiceId?: string;
  ignoreLocalVoice?: boolean;
  active?: boolean;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function useTalaVoice(options?: UseTalaVoiceOptions): UseTalaVoice {
  const siteDefaultVoice = options?.defaultVoiceId || TALA_DEFAULT_VOICE;
  const openRouterReady = Boolean(options?.apiKey && options?.ttsModelId && options?.ttsVoiceId);
  const isMobile = isMobileDevice();
  const provider: "kokoro" | "openrouter" = isMobile
    ? openRouterReady ? "openrouter" : "kokoro"
    : options?.provider === "openrouter" && openRouterReady ? "openrouter" : "kokoro";
  const [enabled, setEnabledState] = useState(() => {
    try { return localStorage.getItem(TALA_STORAGE.voiceEnabled) !== "off"; } catch { return true; }
  });
  const [engine, setEngine] = useState<TalaVoiceEngine>("none");
  const [status, setStatus] = useState<TalaVoiceStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [lastTtsMs, setLastTtsMs] = useState<number | null>(null);
  const [voiceId, setVoiceIdState] = useState(() => {
    if (options?.ignoreLocalVoice) return siteDefaultVoice;
    try { return localStorage.getItem(TALA_STORAGE.voiceId) || siteDefaultVoice; } catch { return siteDefaultVoice; }
  });
  const [previewId, setPreviewId] = useState<string | null>(null);

  const kokoroRef = useRef<KokoroInstance | null>(null);
  const kokoroLoading = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const generationRef = useRef(0);
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;
  const speakStartRef = useRef(0);
  const firstPlayedRef = useRef(false);
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const orConfigRef = useRef<{ apiKey: string; model: string; voice: string } | null>(null);
  orConfigRef.current = provider === "openrouter" ? { apiKey: options!.apiKey!, model: options!.ttsModelId!, voice: options!.ttsVoiceId! } : null;
  const playQueueRef = useRef<(() => Promise<void>) | null>(null);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try { localStorage.setItem(TALA_STORAGE.voiceEnabled, on ? "on" : "off"); } catch {}
  }, []);

  const setVoiceId = useCallback((id: string) => {
    setVoiceIdState(id);
    try { localStorage.setItem(TALA_STORAGE.voiceId, id); } catch {}
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    speakingRef.current = false;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  const noteFirstPlayback = useCallback(() => {
    if (firstPlayedRef.current) return;
    firstPlayedRef.current = true;
    setLastTtsMs(Math.round(performance.now() - speakStartRef.current));
  }, []);

  const active = options?.active ?? true;
  useEffect(() => {
    if (provider !== "kokoro" || isMobile || !active || !enabled || kokoroRef.current || kokoroLoading.current) return;
    kokoroLoading.current = true;
    setLoadProgress(0);
    const startDownload = async () => {
      try {
        const { KokoroTTS } = await import("kokoro-js");
        kokoroRef.current = await KokoroTTS.from_pretrained(TALA_KOKORO_MODEL, {
          dtype: "q8",
          device: "wasm",
          progress_callback: (p: { progress?: number }) => { if (typeof p.progress === "number") setLoadProgress(Math.round(p.progress)); },
        }) as unknown as KokoroInstance;
        setEngine("kokoro");
      } catch {
        setEngine("browser");
      } finally {
        setLoadProgress(null);
        kokoroLoading.current = false;
      }
    };
    if (typeof requestIdleCallback !== "undefined") requestIdleCallback(() => void startDownload(), { timeout: 5000 });
    else setTimeout(() => void startDownload(), 100);
  }, [active, enabled, isMobile, provider]);

  const playQueue = useCallback(async () => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    const generation = generationRef.current;
    setStatus("speaking");

    while (queueRef.current.length && generation === generationRef.current) {
      const chunk = queueRef.current.shift()!;
      try {
        if (providerRef.current === "openrouter" && orConfigRef.current) {
          const blob = await synthesizeOpenRouterTts(chunk, orConfigRef.current);
          if (generation !== generationRef.current) break;
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            const el = new Audio(url);
            audioRef.current = el;
            el.onended = resolve;
            el.onerror = resolve;
            noteFirstPlayback();
            el.play().catch(() => resolve());
          });
          URL.revokeObjectURL(url);
          continue;
        }

        const kokoro = kokoroRef.current;
        if (kokoro) {
          const audio = await kokoro.generate(chunk, { voice: voiceIdRef.current });
          if (generation !== generationRef.current) break;
          const url = URL.createObjectURL(encodePCM16Wav(audio.audio, audio.sampling_rate));
          await new Promise<void>((resolve) => {
            const el = new Audio(url);
            audioRef.current = el;
            el.onended = resolve;
            el.onerror = resolve;
            noteFirstPlayback();
            el.play().catch(() => resolve());
          });
          URL.revokeObjectURL(url);
          continue;
        }

        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          setEngine("browser");
          await new Promise<void>((resolve) => {
            const utter = new SpeechSynthesisUtterance(chunk);
            const browserVoice = pickBrowserVoice();
            if (browserVoice) utter.voice = browserVoice;
            utter.rate = 1;
            utter.pitch = 1.05;
            utter.onend = resolve;
            utter.onerror = resolve;
            noteFirstPlayback();
            window.speechSynthesis.speak(utter);
          });
        }
      } catch {
        // Skip failed chunk; later chunks may still play.
      }
    }

    speakingRef.current = false;
    if (generation === generationRef.current) setStatus("idle");
    // A chunk may have arrived between the final queue check and clearing the
    // speaking flag. Start another drain immediately if needed.
    if (queueRef.current.length && generation === generationRef.current) void playQueueRef.current?.();
  }, [noteFirstPlayback]);
  playQueueRef.current = playQueue;

  const enqueue = useCallback((text: string) => {
    if (!enabled) return;
    const chunks = splitSentences(text);
    if (!chunks.length) return;
    if (!firstPlayedRef.current && queueRef.current.length === 0 && !speakingRef.current) {
      speakStartRef.current = performance.now();
      firstPlayedRef.current = false;
    }
    queueRef.current.push(...chunks);
    void playQueueRef.current?.();
  }, [enabled]);

  const speak = useCallback((text: string) => {
    if (!enabled) return;
    stop();
    speakStartRef.current = performance.now();
    firstPlayedRef.current = false;
    queueRef.current = splitSentences(text);
    void playQueueRef.current?.();
  }, [enabled, stop]);

  const preview = useCallback(async (id: string, text?: string) => {
    setPreviewId(id);
    try {
      const kokoro = kokoroRef.current;
      if (!kokoro) return;
      const audio = await kokoro.generate(text || "Hi, I'm TALA — your friend in San Vicente.", { voice: id });
      const url = URL.createObjectURL(encodePCM16Wav(audio.audio, audio.sampling_rate));
      await new Promise<void>((resolve) => {
        const el = new Audio(url);
        audioRef.current = el;
        el.onended = resolve;
        el.onerror = resolve;
        el.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } finally {
      setPreviewId(null);
    }
  }, []);

  useEffect(() => stop, [stop]);

  return {
    enabled,
    setEnabled,
    engine: provider === "openrouter" ? "openrouter" : engine,
    status,
    loadProgress: provider === "openrouter" ? null : loadProgress,
    lastTtsMs,
    voiceId,
    setVoiceId,
    speak,
    enqueue,
    stop,
    preview,
    previewId,
  };
}
