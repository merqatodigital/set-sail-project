// useTallaStatus — owns real backend status for the Admin.
//
// Polls the proven Cloudflare Worker /api/health and exposes a simple
// owner-facing view (TALA / Computer / Automation / Model). No green lights
// are hard-coded: every value is derived from a live response. If the
// backend can't be reached, status is "unknown" and the UI can say so.
//
// This is purely additive — it never touches the Supabase-backed flows.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchTallaHealth,
  toStatusView,
  type TallaBackendHealth,
  type TallaStatusView,
} from "@/lib/tallaCloud";

const POLL_MS = 30_000;

export interface UseTallaStatus {
  status: TallaStatusView | null;
  loading: boolean;
  error: string | null;
  lastChecked: number | null;
  refresh: () => void;
}

export function useTallaStatus(poll = true): UseTallaStatus {
  const [status, setStatus] = useState<TallaStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const health: TallaBackendHealth = await fetchTallaHealth(ac.signal);
      setStatus(toStatusView(health));
      setError(null);
    } catch (e) {
      // Reachable-but-unhealthy still counts as reachable in toStatusView;
      // only a network failure lands here.
      setStatus({
        label: "TALA — Resort OS",
        tala: "unknown",
        computer: "unknown",
        automation: "unknown",
        model: "unknown",
        reachable: false,
        detail: e instanceof Error ? e.message : "Could not reach TALA backend",
      });
      setError(e instanceof Error ? e.message : "Could not reach TALA backend");
    } finally {
      setLoading(false);
      setLastChecked(Date.now());
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!poll) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [refresh, poll]);

  return { status, loading, error, lastChecked, refresh };
}
