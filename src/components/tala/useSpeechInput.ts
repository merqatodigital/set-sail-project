import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TALA's ears — Web Speech API (built into Chrome, Edge, Safari; free).
// Firefox has no recognizer, so the widget hides the mic button there and
// visitors type instead.
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
  /** Live transcript while speaking (interim + final so far). */
  transcript: string;
  /** Human-readable error (e.g. mic permission denied) or null when healthy. */
  error: string | null;
  /** Device-measured time from mic start → usable transcript (ms), or null. */
  lastRecognitionMs: number | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/**
 * Mobile WebKit/Chrome can end recognition after emitting only interim text.
 * We therefore retain the latest usable transcript and finalize it on `onend`
 * when no final result was emitted. This prevents the common mobile failure
 * where the guest sees their words appear and then TALA silently discards them.
 *
 * @param onFinal called once with the finished utterance.
 * @param onSpeechStart called on the first non-empty recognition result. TALA
 *        uses this for true barge-in so current speech stops as soon as the
 *        guest actually begins talking, not only when the mic button is tapped.
 */
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
  const finalRef = useRef("");
  const latestTranscriptRef = useRef("");
  const startedAtRef = useRef(0);
  const listeningRef = useRef(false);
  const sessionRef = useRef(0);
  const speechStartedRef = useRef(false);
  const suppressFinalizeRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onSpeechStartRef = useRef(onSpeechStart);
  onFinalRef.current = onFinal;
  onSpeechStartRef.current = onSpeechStart;

  useEffect(() => {
    setSupported(getRecognizer() !== null);
  }, []);

  const abort = useCallback(() => {
    sessionRef.current += 1;
    suppressFinalizeRef.current = true;
    listeningRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.abort();
    } catch {
      /* already ended */
    }
    finalRef.current = "";
    latestTranscriptRef.current = "";
    setTranscript("");
    setListening(false);
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !listeningRef.current) return;
    try {
      rec.stop();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    if (listeningRef.current) return;

    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* already ended */
      }
      recRef.current = null;
    }

    const rec = getRecognizer();
    if (!rec) {
      setSupported(false);
      return;
    }

    const session = ++sessionRef.current;
    recRef.current = rec;
    finalRef.current = "";
    latestTranscriptRef.current = "";
    speechStartedRef.current = false;
    suppressFinalizeRef.current = false;
    setTranscript("");
    setError(null);

    rec.lang = "en-PH";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
      if (session !== sessionRef.current) return;

      let interim = "";
      let gotFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current += piece;
          gotFinal = true;
        } else {
          interim += piece;
        }
      }

      const latest = (finalRef.current + interim).trim();
      latestTranscriptRef.current = latest;
      setTranscript(latest);

      if (latest && !speechStartedRef.current) {
        speechStartedRef.current = true;
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        onSpeechStartRef.current?.();
      }

      if (gotFinal) {
        try {
          rec.stop();
        } catch {
          /* recognizer already ending */
        }
      }
    };

    rec.onerror = (event) => {
      if (session !== sessionRef.current) return;
      const err = event?.error;
      listeningRef.current = false;
      setListening(false);

      if (err === "not-allowed" || err === "service-not-allowed" || err === "network" || err === "aborted") {
        suppressFinalizeRef.current = true;
      }

      if (err === "not-allowed" || err === "service-not-allowed") {
        setError("Microphone access was denied. Enable it in your browser settings to speak to TALA.");
      } else if (err === "network") {
        setError("Speech recognition needs a connection. Check your network and try again.");
      } else if (err && err !== "no-speech" && err !== "aborted") {
        setError("The microphone had a problem. Please try again.");
      }
    };

    rec.onend = () => {
      if (session !== sessionRef.current) return;

      listeningRef.current = false;
      recRef.current = null;
      setListening(false);

      const text = suppressFinalizeRef.current
        ? ""
        : (finalRef.current.trim() || latestTranscriptRef.current.trim());

      finalRef.current = "";
      latestTranscriptRef.current = "";
      setTranscript("");

      if (text) {
        const ms = Math.round(performance.now() - startedAtRef.current);
        console.debug(`[TALA] speech → transcript in ${ms}ms`, text.slice(0, 60));
        setLastRecognitionMs(ms);
        onFinalRef.current(text);
      }
    };

    try {
      listeningRef.current = true;
      startedAtRef.current = performance.now();
      rec.start();
      setListening(true);
    } catch {
      listeningRef.current = false;
      recRef.current = null;
      setListening(false);
      setError("Could not start the microphone. Please try again.");
    }
  }, []);

  useEffect(() => abort, [abort]);

  return { supported, listening, transcript, error, lastRecognitionMs, start, stop, abort };
}
