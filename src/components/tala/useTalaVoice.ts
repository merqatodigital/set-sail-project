import { useCallback, useEffect, useRef, useState } from "react";
import {
  OPENROUTER_TTS_ENDPOINT,
  TALA_DEFAULT_VOICE,
  TALA_KOKORO_MODEL,
  TALA_STORAGE,
} from "./talaConfig";

// ---------------------------------------------------------------------------
// TALA voice policy
//
// The public site must never sit silent waiting for an 80 MB model download.
// Kokoro remains the preferred natural, open-source desktop voice and loads in
// the background after the widget opens. Until it is ready, browser speech is
// used immediately. Mobile always uses browser speech unless a hosted provider
// is explicitly configured, avoiding the large WASM/model download and CPU hit.
// ---------------------------------------------------------------------------

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
    body: JSON.stringify({
      model: config.model,
      input: text,
      voice: config.voice,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      message = errBody?.error?.message || message;
    } catch {
      /* ignore malformed provider errors */
    }
    throw new Error(message);
  }
  return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
}

type KokoroRawAudio = { audio: Float32Array; sampling_rate: number };
type KokoroInstance = {
  generate: (text: string, options: { voice: string }) => Promise<KokoroRawAudio>;
};

function encodePCM16Wav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
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

export type TalaVoiceEngine = "kokoro" | "openrouter" | "browser" | "none";
export type TalaVoiceStatus = "idle" | "loading" | "speaking";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function normalizeForSpeech(text: string): string {
  return text
    .replace(/(?:PHP|₱)\s?([\d,]+(?:\.\d+)?)/gi, "$1 pesos")
    .replace(/\bPHP\b/gi, "pesos")
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
  const cleaned = normalizeForSpeech(text)
    .replace(/[*_#`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const parts = cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [cleaned];
  const chunks: string[] = [];
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    if (chunks.length && part.length < 12) {
      chunks[chunks.length - 1] += ` ${part}`;
    } else {
      chunks.push(part);
    }
  }

  // Keep the first synthesis unit short. A short opener starts materially
  // faster in both Kokoro and hosted TTS than a long paragraph-sized chunk.
  if (chunks.length && chunks[0].length > 90) {
    const first = chunks[0];
    const splitAt = first.search(/[,;:—–]\s/);
    if (splitAt > 12 && splitAt < 70) {
      const head = first.slice(0, splitAt + 1).trim();
      const tail = first.slice(splitAt + 1).trim();
      if (head && tail) chunks.splice(0, 1, head, tail);
    }
  }
  return chunks;
}

function pickBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const preferred = [
    "samantha",
    "aria",
    "jenny",
    "libby",
    "sonia",
    "natasha",
    "zira",
    "google us english",
    "female",
  ];
  for (const name of preferred) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(name));
    if (hit) return hit;
  }
  return pool[0] ?? null;
}

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

export function useTalaVoice(options?: UseTalaVoiceOptions): UseTalaVoice {
  const isMobile = isMobileDevice();
  const siteDefaultVoice = options?.defaultVoiceId || TALA_DEFAULT_VOICE;
  const openRouterReady = Boolean(options?.apiKey && options?.ttsModelId && options?.ttsVoiceId);
  const preferredProvider: "kokoro" | "openrouter" =
    options?.provider === "openrouter" && openRouterReady ? "openrouter" : "kokoro";

  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TALA_STORAGE.voiceEnabled) !== "off";
    } catch {
      return true;
    }
  });
  const [voiceId, setVoiceIdState] = useState<string>(() => {
    if (options?.ignoreLocalVoice) return siteDefaultVoice;
    try {
      return localStorage.getItem(TALA_STORAGE.voiceId) || siteDefaultVoice;
    } catch {
      return siteDefaultVoice;
    }
  });
  const [engine, setEngine] = useState<TalaVoiceEngine>(
    preferredProvider === "openrouter" ? "openrouter" : "browser",
  );
  const [status, setStatus] = useState<TalaVoiceStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [lastTtsMs, setLastTtsMs] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const kokoroRef = useRef<KokoroInstance | null>(null);
  const kokoroLoadingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generationRef = useRef(0);
  const speakStartRef = useRef(0);
  const firstPlayedRef = useRef(false);
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;

  const configRef = useRef({
    provider: preferredProvider,
    openRouter: openRouterReady
      ? { apiKey: options!.apiKey!, model: options!.ttsModelId!, voice: options!.ttsVoiceId! }
      : null,
  });
  configRef.current = {
    provider: preferredProvider,
    openRouter: openRouterReady
      ? { apiKey: options!.apiKey!, model: options!.ttsModelId!, voice: options!.ttsVoiceId! }
      : null,
  };

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      localStorage.setItem(TALA_STORAGE.voiceEnabled, on ? "on" : "off");
    } catch {
      /* non-persistent */
    }
  }, []);

  const setVoiceId = useCallback((id: string) => {
    setVoiceIdState(id);
    try {
      localStorage.setItem(TALA_STORAGE.voiceId, id);
    } catch {
      /* non-persistent */
    }
  }, []);

  const noteFirstPlayback = useCallback(() => {
    if (firstPlayedRef.current) return;
    firstPlayedRef.current = true;
    const ms = Math.round(performance.now() - speakStartRef.current);
    console.debug(`[TALA] reply → first audio in ${ms}ms`);
    setLastTtsMs(ms);
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus("idle");
  }, []);

  // iOS/WebKit needs one user gesture to unlock later async audio playback.
  const unlockedRef = useRef(false);
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      try {
        const primer = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==",
        );
        primer.volume = 0;
        void primer.play().catch(() => {});
        if ("speechSynthesis" in window) window.speechSynthesis.resume();
      } catch {
        /* best effort */
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Kokoro is a background enhancement, never a blocking dependency. On a cold
  // visit TALA speaks with the best local browser voice immediately while the
  // natural model downloads; later replies automatically switch to Kokoro.
  const active = options?.active ?? true;
  useEffect(() => {
    if (!enabled || !active || isMobile || preferredProvider !== "kokoro") return;
    if (kokoroRef.current || kokoroLoadingRef.current) return;

    let cancelled = false;
    const start = async () => {
      kokoroLoadingRef.current = true;
      setLoadProgress(0);
      try {
        const { KokoroTTS } = await import("kokoro-js");
        const tts = (await KokoroTTS.from_pretrained(TALA_KOKORO_MODEL, {
          dtype: "q8",
          device: "wasm",
          progress_callback: (p: { progress?: number }) => {
            if (!cancelled && typeof p?.progress === "number") {
              setLoadProgress(Math.round(p.progress));
            }
          },
        })) as unknown as KokoroInstance;
        if (!cancelled) {
          kokoroRef.current = tts;
          setEngine("kokoro");
        }
      } catch (err) {
        console.warn("[TALA] Kokoro unavailable; keeping instant browser voice.", err);
        if (!cancelled) setEngine("browser");
      } finally {
        kokoroLoadingRef.current = false;
        if (!cancelled) setLoadProgress(null);
      }
    };

    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    }).requestIdleCallback;
    const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    if (ric) idleId = ric(() => void start(), { timeout: 1500 });
    else timerId = setTimeout(() => void start(), 50);

    return () => {
      cancelled = true;
      if (idleId !== null) cic?.(idleId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [active, enabled, isMobile, preferredProvider]);

  const speakBrowserChunk = useCallback(
    (chunk: string, generation: number) =>
      new Promise<void>((resolve) => {
        if (generation !== generationRef.current) return resolve();
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
        const utter = new SpeechSynthesisUtterance(chunk);
        const selected = pickBrowserVoice();
        if (selected) utter.voice = selected;
        utter.rate = 1;
        utter.pitch = 1.03;
        utter.onstart = noteFirstPlayback;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      }),
    [noteFirstPlayback],
  );

  const playBlob = useCallback(
    (blob: Blob, generation: number) =>
      new Promise<void>((resolve) => {
        if (generation !== generationRef.current) return resolve();
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        audioRef.current = el;
        el.onplaying = noteFirstPlayback;
        const finish = () => {
          URL.revokeObjectURL(url);
          if (audioRef.current === el) audioRef.current = null;
          resolve();
        };
        el.onended = finish;
        el.onerror = finish;
        void el.play().catch(finish);
      }),
    [noteFirstPlayback],
  );

  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      const chunks = splitSentences(text);
      if (!chunks.length) return;

      stop();
      const generation = generationRef.current;
      speakStartRef.current = performance.now();
      firstPlayedRef.current = false;
      setStatus("speaking");

      void (async () => {
        try {
          for (const chunk of chunks) {
            if (generation !== generationRef.current) return;
            const cfg = configRef.current;

            if (cfg.provider === "openrouter" && cfg.openRouter) {
              try {
                const blob = await synthesizeOpenRouterTts(chunk, cfg.openRouter);
                if (generation !== generationRef.current) return;
                await playBlob(blob, generation);
                continue;
              } catch (err) {
                console.warn("[TALA] Hosted TTS failed; using browser speech.", err);
                await speakBrowserChunk(chunk, generation);
                continue;
              }
            }

            const kokoro = !isMobile ? kokoroRef.current : null;
            if (kokoro) {
              try {
                const raw = await kokoro.generate(chunk, { voice: voiceIdRef.current });
                if (generation !== generationRef.current) return;
                await playBlob(encodePCM16Wav(raw.audio, raw.sampling_rate), generation);
                continue;
              } catch (err) {
                console.warn("[TALA] Kokoro generation failed; using browser speech.", err);
              }
            }

            // Critical latency rule: do not wait for Kokoro to finish loading.
            // Speak now. The next reply can use Kokoro once it is ready.
            await speakBrowserChunk(chunk, generation);
          }
        } finally {
          if (generation === generationRef.current) setStatus("idle");
        }
      })();
    },
    [enabled, isMobile, playBlob, speakBrowserChunk, stop],
  );

  const preview = useCallback(
    async (id: string, text?: string) => {
      const sample = text || "Hi, I'm TALA — your friend in San Vicente. Lovely to meet you!";
      setPreviewId(id);
      try {
        const cfg = configRef.current;
        if (cfg.provider === "openrouter" && cfg.openRouter) {
          speak(sample);
          return;
        }

        // Preview is an explicit admin action, so loading Kokoro on demand is
        // acceptable here even if the public widget has not loaded it yet.
        let kokoro = kokoroRef.current;
        if (!kokoro && !isMobile) {
          setLoadProgress(0);
          const { KokoroTTS } = await import("kokoro-js");
          kokoro = (await KokoroTTS.from_pretrained(TALA_KOKORO_MODEL, {
            dtype: "q8",
            device: "wasm",
            progress_callback: (p: { progress?: number }) => {
              if (typeof p?.progress === "number") setLoadProgress(Math.round(p.progress));
            },
          })) as unknown as KokoroInstance;
          kokoroRef.current = kokoro;
          setEngine("kokoro");
          setLoadProgress(null);
        }

        if (!kokoro) {
          speak(sample);
          return;
        }
        const generation = generationRef.current;
        const raw = await kokoro.generate(sample, { voice: id });
        await playBlob(encodePCM16Wav(raw.audio, raw.sampling_rate), generation);
      } catch (err) {
        console.warn("[TALA] Voice preview failed.", err);
      } finally {
        setLoadProgress(null);
        setPreviewId(null);
      }
    },
    [isMobile, playBlob, speak],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
  }, []);

  useEffect(() => stop, [stop]);

  const effectiveEngine: TalaVoiceEngine =
    preferredProvider === "openrouter" && openRouterReady
      ? "openrouter"
      : isMobile
        ? "browser"
        : engine;

  return {
    enabled,
    setEnabled,
    engine: effectiveEngine,
    status,
    loadProgress: effectiveEngine === "openrouter" || isMobile ? null : loadProgress,
    lastTtsMs,
    voiceId,
    setVoiceId,
    speak,
    stop,
    preview,
    previewId,
  };
}
