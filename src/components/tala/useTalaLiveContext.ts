import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import { fetchKnowledge, knowledgeForPrompt } from "./talaKnowledge";

// ---------------------------------------------------------------------------
// TALA's live context — the data the agent actually reasons over, pulled
// straight from the live database tables (rooms, tours, motorbikes) plus the
// admin-maintained knowledge base. Whatever an admin saves in the Knowledge
// Base or edits in Rooms/Tours/Rentals is what TALA says on the next message.
// ---------------------------------------------------------------------------

interface LiveRoom {
  name: string;
  type: string;
  capacity: number;
  rate_php: number;
  status: string | null;
}

interface LiveTour {
  name: string;
  description: string;
  duration: string;
  price: number;
  capacity: number;
  inclusions: string[];
  active: boolean;
}

interface LiveBike {
  name: string;
  model: string;
  daily_rate: number;
  active: boolean;
  status: string;
}

/** Fetch live rooms/tours/bikes/knowledge and format them as a prompt section. */
export async function fetchTalaLiveContext(): Promise<string> {
  if (!isSupabaseConnected() || !supabase) return "";

  const [knowledgeEntries, roomsRes, toursRes, bikesRes] = await Promise.all([
    fetchKnowledge().catch(() => []),
    supabase
      .from("rooms")
      .select("name, type, capacity, rate_php, status")
      .order("name"),
    supabase
      .from("tours_catalog")
      .select("name, description, duration, price, capacity, inclusions, active")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("motorbikes")
      .select("name, model, daily_rate, active, status")
      .eq("active", true)
      .order("name"),
  ]);

  const sections: string[] = [
    "## Live data (pulled fresh from the booking system — trust this over anything conflicting above)",
  ];

  const rooms = (roomsRes.data ?? []) as LiveRoom[];
  if (rooms.length) {
    sections.push(
      "### Rooms (live)\n" +
        rooms
          .map(
            (r) =>
              `- ${r.name} (${r.type}): ${Math.round(r.rate_php).toLocaleString("en-PH")} pesos per night, sleeps ${r.capacity}${r.status && r.status !== "available" ? ` [${r.status}]` : ""}`,
          )
          .join("\n"),
    );
  }

  const tours = (toursRes.data ?? []) as LiveTour[];
  if (tours.length) {
    sections.push(
      "### Tours (live)\n" +
        tours
          .map(
            (t) =>
              `- ${t.name}: ${Math.round(t.price).toLocaleString("en-PH")} pesos per person, ${t.duration}, up to ${t.capacity} guests. ${t.description}${t.inclusions?.length ? ` Includes: ${t.inclusions.join(", ")}.` : ""}`,
          )
          .join("\n"),
    );
  }

  const bikes = (bikesRes.data ?? []) as LiveBike[];
  if (bikes.length) {
    sections.push(
      "### Motorbike rentals (live)\n" +
        bikes
          .map(
            (b) =>
              `- ${b.name} (${b.model}): ${Math.round(b.daily_rate).toLocaleString("en-PH")} pesos per day [${b.status}]`,
          )
          .join("\n"),
    );
  }

  const knowledge = knowledgeForPrompt(knowledgeEntries);
  if (knowledge) {
    sections.push("### Knowledge base (admin-maintained facts)\n" + knowledge);
  }

  return sections.length > 1 ? sections.join("\n\n") : "";
}

/**
 * React hook: loads the live context on mount and exposes refresh().
 * Call refresh() when opening the widget or after editing data so the agent
 * always answers from the latest state.
 */
export function useTalaLiveContext() {
  const [context, setContext] = useState("");

  const refresh = useCallback(async () => {
    try {
      setContext(await fetchTalaLiveContext());
    } catch {
      // Live context is best-effort — the base prompt still works without it.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { context, refresh };
}

/** Append live context to a base system prompt. */
export function withLiveContext(basePrompt: string, liveContext: string): string {
  return liveContext ? `${basePrompt}\n\n${liveContext}` : basePrompt;
}
