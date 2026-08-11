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
  /** Device-measured time from mic start → final transcript (ms), or null. */
  lastRecognitionMs: number | null;
  start: () => void;
  stop: () => void;
}

/**
 * @param onFinal called with the finished utterance when the visitor stops
 *                speaking — the widget sends it to TALA automatically.
 * @param onSpeechStart fired on the FIRST recognized sound of an utterance
 *                (interim or final). The widget uses it for barge-in so TALA
 *                goes quiet the instant the guest starts speaking.
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
  const startedAtRef = useRef(0);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onSpeechStartRef = useRef(onSpeechStart);
  onSpeechStartRef.current = onSpeechStart;
  const spokeRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognizer() !== null);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (listening) return;
    const rec = getRecognizer();
    if (!rec) return;
    recRef.current = rec;
    finalRef.current = "";
    spokeRef.current = false;
    setTranscript("");
    setError(null);
    rec.lang = "en-PH"; // English with Filipino accent support; falls back to en-US
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
      // Barge-in: the guest is speaking — silence TALA immediately, without
      // waiting for the utterance to finish.
      if (!spokeRef.current) {
        spokeRef.current = true;
        onSpeechStartRef.current?.();
      }
      let interim = "";
      let gotFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalRef.current += result[0].transcript;
          gotFinal = true;
        } else interim += result[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
      // Chrome's non-continuous recognizer doesn't end on the first final
      // result — it waits out its own ~1-1.5s internal silence timer first.
      // Stopping as soon as we have a final result removes that dead air.
      if (gotFinal) rec.stop();
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      setTranscript("");
      if (text) {
        const ms = Math.round(performance.now() - startedAtRef.current);
        console.debug(`[TALA] speech → transcript in ${ms}ms`, text.slice(0, 60));
        setLastRecognitionMs(ms);
        onFinalRef.current(text);
      }
    };
    rec.onerror = (event) => {
      // "no-speech" → idle quietly. Permission problems get real feedback so
      // the guest knows the mic isn't just broken.
      const err = event?.error;
      setListening(false);
      setTranscript("");
      if (err === "not-allowed" || err === "service-not-allowed") {
        setError("Microphone access was denied. Enable it in your browser settings to speak to TALA.");
      } else if (err === "network") {
        setError("Speech recognition needs a connection. Check your network and try again.");
      } else if (err && err !== "no-speech" && err !== "aborted") {
        setError("The microphone had a problem. Please try again.");
      }
    };

    try {
      rec.start();
      startedAtRef.current = performance.now();
      setListening(true);
    } catch {
      setListening(false);
      setError("Could not start the microphone. Please try again.");
    }
  }, [listening]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, transcript, error, lastRecognitionMs, start, stop };
}
