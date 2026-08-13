import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TALA's ears — Web Speech API (built into Chrome, Edge, Safari; free).
// Firefox has no recognizer, so the widget hides the mic button there and
// visitors type instead.
//
// IMPORTANT: this hook now keeps one listening session alive across turns.
// A guest taps the mic once, speaks naturally, and each final utterance is
// delivered to TALA without forcing another tap. The session ends only when
// the guest presses Stop, closes the widget, aborts, or the browser reports a
// non-recoverable permission/network error.
// ---------------------------------------------------------------------------

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export interface UseSpeechInput {
  supported: boolean;
  listening: boolean;
  /** Live transcript while speaking. */
  transcript: string;
  /** Human-readable error (e.g. mic permission denied) or null when healthy. */
  error: string | null;
  /** Device-measured time from start of the current utterance to usable transcript. */
  lastRecognitionMs: number | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function useSpeechInput(
  onFinal: (text: string) => void,
  onSpeechStart?: () => void,
): UseSpeechInput {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastRecognitionMs, setLastRecognitionMs] = useState<number | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const latestTranscriptRef = useRef("");
  const utteranceStartedAtRef = useRef(0);
  const listeningRef = useRef(false);
  const keepAliveRef = useRef(false);
  const sessionRef = useRef(0);
  const speechStartedRef = useRef(false);
  const suppressFinalizeRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const onFinalRef = useRef(onFinal);
  const onSpeechStartRef = useRef(onSpeechStart);
  onFinalRef.current = onFinal;
  onSpeechStartRef.current = onSpeechStart;

  useEffect(() => {
    setSupported(getRecognizer() !== null);
  }, []);

  const clearRestartTimer = () => {
    if (restartTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const abort = useCallback(() => {
    sessionRef.current += 1;
    keepAliveRef.current = false;
    suppressFinalizeRef.current = true;
    listeningRef.current = false;
    clearRestartTimer();
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.abort();
    } catch {
      /* already ended */
    }
    latestTranscriptRef.current = "";
    speechStartedRef.current = false;
    setTranscript("");
    setListening(false);
  }, []);

  const stop = useCallback(() => {
    keepAliveRef.current = false;
    listeningRef.current = false;
    suppressFinalizeRef.current = true;
    clearRestartTimer();
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* already ended */
    }
    latestTranscriptRef.current = "";
    speechStartedRef.current = false;
    setTranscript("");
    setListening(false);
  }, []);

  const createAndStartRecognizer = useCallback((session: number) => {
    if (!keepAliveRef.current || session !== sessionRef.current) return;

    const rec = getRecognizer();
    if (!rec) {
      keepAliveRef.current = false;
      listeningRef.current = false;
      setSupported(false);
      setListening(false);
      return;
    }

    recRef.current = rec;
    latestTranscriptRef.current = "";
    speechStartedRef.current = false;
    suppressFinalizeRef.current = false;
    setTranscript("");
    setError(null);

    rec.lang = "en-PH";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      if (session !== sessionRef.current || !keepAliveRef.current) return;

      let interim = "";
      const finals: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (result.isFinal) finals.push(piece);
        else interim += `${piece} `;
      }

      const latest = interim.trim();
      latestTranscriptRef.current = latest;
      setTranscript(latest);

      const audibleText = finals.join(" ").trim() || latest;
      if (audibleText && !speechStartedRef.current) {
        speechStartedRef.current = true;
        utteranceStartedAtRef.current = performance.now();
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        onSpeechStartRef.current?.();
      }

      if (finals.length) {
        const text = finals.join(" ").trim();
        latestTranscriptRef.current = "";
        speechStartedRef.current = false;
        setTranscript("");
        if (text) {
          const ms = Math.round(performance.now() - utteranceStartedAtRef.current);
          console.debug(`[TALA] speech → transcript in ${ms}ms`, text.slice(0, 60));
          setLastRecognitionMs(ms);
          onFinalRef.current(text);
        }
      }
    };

    rec.onerror = (event) => {
      if (session !== sessionRef.current) return;
      const err = event?.error;
      recRef.current = null;

      if (err === "not-allowed" || err === "service-not-allowed") {
        keepAliveRef.current = false;
        listeningRef.current = false;
        setListening(false);
        setError("Microphone access was denied. Enable it in your browser settings to speak to TALA.");
        return;
      }

      if (err === "network") {
        // Web Speech can briefly lose its recognition backend on mobile. Keep
        // the user's one-tap session alive and let onend restart once.
        setError("Speech recognition connection was interrupted. Reconnecting…");
        return;
      }

      if (err && err !== "no-speech" && err !== "aborted") {
        setError("The microphone had a problem. Reconnecting…");
      }
    };

    rec.onend = () => {
      if (session !== sessionRef.current) return;
      recRef.current = null;

      // Some mobile browsers end recognition even in continuous mode. If the
      // guest has not pressed Stop, restart transparently instead of forcing a
      // second mic tap.
      if (keepAliveRef.current) {
        listeningRef.current = true;
        setListening(true);
        if (typeof window !== "undefined") {
          clearRestartTimer();
          restartTimerRef.current = window.setTimeout(() => {
            if (keepAliveRef.current && session === sessionRef.current && !recRef.current) {
              createAndStartRecognizer(session);
            }
          }, 180);
        }
      } else {
        listeningRef.current = false;
        setListening(false);
      }
    };

    try {
      listeningRef.current = true;
      setListening(true);
      rec.start();
    } catch {
      recRef.current = null;
      if (keepAliveRef.current && typeof window !== "undefined") {
        restartTimerRef.current = window.setTimeout(() => createAndStartRecognizer(session), 250);
      } else {
        listeningRef.current = false;
        setListening(false);
        setError("Could not start the microphone. Please try again.");
      }
    }
  }, []);

  const start = useCallback(() => {
    if (keepAliveRef.current || listeningRef.current) return;
    clearRestartTimer();
    const session = ++sessionRef.current;
    keepAliveRef.current = true;
    listeningRef.current = true;
    suppressFinalizeRef.current = false;
    setError(null);
    setListening(true);
    createAndStartRecognizer(session);
  }, [createAndStartRecognizer]);

  useEffect(() => abort, [abort]);

  return { supported, listening, transcript, error, lastRecognitionMs, start, stop, abort };
}
