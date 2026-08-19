import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Voice DISABLED for performance. All methods are no-ops.
// The interface is preserved so TalaWidget compiles without changes.
// To re-enable, restore the Kokoro/browser TTS implementation.
// ---------------------------------------------------------------------------

// The unions keep their historical members so admin UI that reports engine /
// status (TalaManager) still typechecks while voice stays disabled at runtime.
export type TalaVoiceEngine = "none" | "kokoro" | "browser" | "openrouter";
export type TalaVoiceStatus = "idle" | "loading" | "speaking" | "error";

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

export function useTalaVoice(options?: UseTalaVoiceOptions): UseTalaVoice {
  const [enabled, setEnabled] = useState(false);

  const stop = useCallback(() => {}, []);
  const speak = useCallback((_text: string) => {}, []);
  const enqueue = useCallback((_text: string) => {}, []);
  const preview = useCallback(async (_id: string, _text?: string) => {}, []);
  const setVoiceId = useCallback((_id: string) => {}, []);

  return {
    enabled,
    setEnabled,
    engine: "none",
    status: "idle",
    loadProgress: null,
    lastTtsMs: null,
    voiceId: options?.defaultVoiceId || "af_heart",
    setVoiceId,
    speak,
    enqueue,
    stop,
    preview,
    previewId: null,
  };
}
