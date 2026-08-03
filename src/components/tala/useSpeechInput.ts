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
  start: () => void;
  stop: () => void;
}

/**
 * @param onFinal called with the finished utterance when the visitor stops
 *                speaking — the widget sends it to TALA automatically.
 */
export function useSpeechInput(onFinal: (text: string) => void): UseSpeechInput {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

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
    setTranscript("");
    rec.lang = "en-PH"; // English with Filipino accent support; falls back to en-US
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
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
      if (text) onFinalRef.current(text);
    };
    rec.onerror = () => {
      // "no-speech" / "not-allowed" — just return to idle quietly.
      setListening(false);
      setTranscript("");
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, transcript, start, stop };
}
