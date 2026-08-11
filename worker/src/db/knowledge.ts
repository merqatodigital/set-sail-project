// Server-side resort knowledge retrieval for TallaAgent.
//
// Marina Terrace is the flagship property and its STABLE knowledge is compiled
// directly into the Worker. This deliberately removes a cross-service Supabase
// fetch from every public chat turn: TALA can answer property/local questions
// even when Supabase is slow or temporarily unavailable.
//
// IMPORTANT: only stable knowledge belongs here. Prices, availability, menu
// inventory, booking status, live operations and other mutable facts still come
// from D1/tools and always override this reference knowledge.
//
// Other tenants continue to use public.tala_knowledge in Supabase until they
// receive their own compiled knowledge bundle.

import type { Env } from "../env.js";

export interface ResortKnowledgeEntry {
  id: string;
  topic: string;
  label: string;
  body: string;
  tags: string;
}

/**
 * Stable Marina Terrace memory.
 *
 * Keep this broad enough that TALA always knows the property and destination,
 * while keeping volatile operational truth out of the bundle. The live system
 * prompt already injects D1 property settings, tours and menu data on every turn.
 */
const MARINA_TERRACE_KNOWLEDGE: ResortKnowledgeEntry[] = [
  {
    id: "hardcoded-source-of-truth",
    topic: "source-of-truth",
    label: "How to use this memory",
    tags: "priority,grounding,live-data",
    body: "This memory contains stable background knowledge about Marina Terrace and San Vicente. For prices, availability, room inventory, menu stock, tour schedules, booking status, payments, check-in status, current policies, or any other live operational fact, use the current resort tools and D1 data. Live tool data always overrides this memory. Never invent a current price or availability from memory.",
  },
  {
    id: "hardcoded-identity",
    topic: "identity",
    label: "Marina Terrace identity and positioning",
    tags: "marina-terrace,digital-nomads,remote-work,poblacion",
    body: "Marina Terrace is in Poblacion, San Vicente, Palawan, Philippines. It is designed around longer stays, remote work and a quiet community atmosphere rather than party tourism. The property combines private long-stay rooms, a rooftop ocean-view workspace, shared kitchen facilities and local San Vicente experiences. TALA should describe it naturally as a practical home base for remote workers and travelers who want reliable work infrastructure and a slower Palawan stay.",
  },
  {
    id: "hardcoded-workspace",
    topic: "workspace",
    label: "Rooftop workspace",
    tags: "coworking,workspace,rooftop,ocean-view,deep-work",
    body: "The rooftop is the core remote-work space at Marina Terrace. It is open-air, shaded for tropical glare, arranged for laptop work and video calls, and designed around ocean views and airflow. Power is available at work positions. Marina Terrace follows a quiet deep-work approach during work hours so guests can focus and take calls without a loud cafe or party atmosphere. Day visitors may be able to use the workspace through a Day Pass; use live resort data for the current Day Pass price and inclusions.",
  },
  {
    id: "hardcoded-internet",
    topic: "internet",
    label: "Internet and connectivity",
    tags: "starlink,wifi,backup,remote-work,video-calls",
    body: "Marina Terrace uses Starlink as its primary internet connection and maintains cellular backup connectivity for resilience. The setup is intended for remote work, video calls and normal cloud work. During a primary-link outage, backup connectivity may have lower bandwidth, so TALA should set realistic expectations rather than promise perfect internet under every weather or network condition. Guests should never be instructed to move, reset or service the Starlink hardware themselves.",
  },
  {
    id: "hardcoded-power",
    topic: "power",
    label: "Power resilience",
    tags: "power,generator,outlets,remote-work",
    body: "Marina Terrace is designed for working travelers and includes backup-power planning for local outages. Work areas have accessible power for laptops and devices. If a guest reports a current outage or equipment problem, TALA should use the live maintenance or guest-request workflow rather than relying on this background memory for the present status.",
  },
  {
    id: "hardcoded-kitchen",
    topic: "kitchen",
    label: "Shared guest kitchen",
    tags: "kitchen,cooking,seafood,groceries,community",
    body: "A shared guest kitchen is part of the Marina Terrace long-stay concept. Guests can buy groceries and fresh local ingredients in Poblacion and prepare food rather than depending on restaurant meals every day. Basic cookware and common kitchen facilities are provided. Guests should clean as they go, store food responsibly, label perishables when appropriate, keep noise low late at night and report faulty equipment instead of attempting repairs. Use live property information for current kitchen hours, included supplies and any service changes.",
  },
  {
    id: "hardcoded-local-food",
    topic: "local-food",
    label: "Local food and groceries",
    tags: "food,seafood,market,poblacion,groceries",
    body: "Poblacion is practical for longer stays because everyday food is nearby: sari-sari stores, vegetable stands, bakeries and local sellers are accessible around town. Fresh seafood is part of local life and guests can ask staff where to buy the day's catch. TALA should favor specific, grounded local suggestions and make clear that availability changes daily.",
  },
  {
    id: "hardcoded-rooms",
    topic: "rooms",
    label: "Long-stay rooms",
    tags: "rooms,stay,long-stay,air-conditioning,desk",
    body: "Marina Terrace offers private rooms intended for comfortable longer stays. Typical room features include air-conditioning, private bathroom, Wi-Fi, a work surface or desk, linens and towels, with room size and exact amenities varying by room category. The property has historically used UNO, DUE and TRE room naming. TALA must use live room data for currently offered categories, exact amenities, occupancy, rates and availability.",
  },
  {
    id: "hardcoded-long-stay",
    topic: "long-stay",
    label: "Long stays and digital nomads",
    tags: "long-stay,digital-nomad,weekly,monthly,community",
    body: "Marina Terrace is built to make one-to-three-month Palawan stays workable, not just weekend tourism. The useful combination is a private room, reliable work setup, kitchen access, local transport options and an environment where remote workers can settle into a routine. Weekly, monthly and package offers may exist, but TALA must read current pricing and inclusions from live resort data before quoting them.",
  },
  {
    id: "hardcoded-evening",
    topic: "evening",
    label: "Sunset and evening atmosphere",
    tags: "sunset,rooftop,community,evening",
    body: "Late afternoon and sunset are part of the Marina Terrace rhythm. The rooftop shifts from focused work toward a more relaxed social atmosphere as the workday ends, with ocean views and an easy community feel. TALA can mention the sunset atmosphere when relevant, but should not promise a specific event, drink service or schedule unless current resort data confirms it.",
  },
  {
    id: "hardcoded-san-vicente",
    topic: "san-vicente",
    label: "San Vicente overview",
    tags: "san-vicente,palawan,poblacion,port-barton,alimanguan",
    body: "San Vicente is a municipality on Palawan with several distinct areas. Poblacion is the municipal center and the area around San Vicente Airport; Port Barton is a more established tourism enclave with island hopping, cafes, hostels and dive activity; Alimanguan is farther north and is known for its fishing-village character, long beach sections and seasonal surf. Marina Terrace is in Poblacion, making it a useful base for exploring these areas without staying in the busiest tourism zone.",
  },
  {
    id: "hardcoded-airport",
    topic: "airport",
    label: "San Vicente Airport",
    tags: "airport,swl,transport,poblacion",
    body: "San Vicente Airport (SWL) is close to Poblacion and Marina Terrace compared with transfers from Puerto Princesa or El Nido. Travel time from the airport is normally short, but TALA should avoid giving a guaranteed minute estimate because traffic, road works and pickup arrangements can change. For an actual pickup or transfer request, use the current resort service workflow.",
  },
  {
    id: "hardcoded-puerto-princesa",
    topic: "transport-puerto-princesa",
    label: "Travel from Puerto Princesa",
    tags: "puerto-princesa,pps,van,transport",
    body: "Puerto Princesa is south of San Vicente and travelers normally come north by shared van, private transfer, bus/van connection or rental vehicle. Journey time varies substantially with the service, stops and road conditions, so TALA should give a range only when current transport guidance is available and should not present an old travel-time estimate as a guarantee. Guests arranging a time-sensitive airport connection should allow a generous buffer.",
  },
  {
    id: "hardcoded-el-nido",
    topic: "transport-el-nido",
    label: "Travel from El Nido",
    tags: "el-nido,eni,van,transport",
    body: "El Nido is north of San Vicente. Guests commonly travel between El Nido and Poblacion by shared van or private transfer. Actual duration depends on pickup location, stops and road conditions. Marina Terrace can help guests understand transfer options; use live service data for any current transfer provider, price or confirmed pickup.",
  },
  {
    id: "hardcoded-port-barton",
    topic: "port-barton",
    label: "Port Barton",
    tags: "port-barton,island-hopping,day-trip,diving",
    body: "Port Barton is one of San Vicente's best-known visitor areas. It has a relaxed tourism scene with cafes, bars, hostels, dive operators and frequent island-hopping departures. It works well as a day trip or part of a wider San Vicente stay. Land travel from Poblacion takes longer than the short straight-line distance across the bay suggests because the road route loops inland. Boat options are highly weather-, tide- and operator-dependent, so never promise a fixed boat connection without live confirmation.",
  },
  {
    id: "hardcoded-alimanguan",
    topic: "alimanguan",
    label: "Alimanguan and surfing",
    tags: "alimanguan,surfing,beach,north-san-vicente",
    body: "Alimanguan lies north of Poblacion and combines a traditional fishing-village feel with a long beach and seasonal surf. It is one of the areas to mention when guests want a quieter coastal excursion away from the better-known Port Barton circuit. Surf conditions are seasonal and weather-dependent; TALA should not guarantee waves or lesson availability without current information.",
  },
  {
    id: "hardcoded-long-beach",
    topic: "long-beach",
    label: "Long Beach and nearby beaches",
    tags: "long-beach,beaches,palawan,poblacion",
    body: "San Vicente is known for its very long stretch of white-sand coastline commonly called Long Beach, extending through several barangays north of Poblacion. Around Poblacion there are also smaller local beach areas and coastal viewpoints. Conditions, access points and swimming suitability change with tide and weather, so TALA should give practical guidance and avoid describing every beach day as guaranteed calm water.",
  },
  {
    id: "hardcoded-island-hopping",
    topic: "island-hopping",
    label: "Island hopping and snorkeling",
    tags: "island-hopping,snorkeling,turtles,coral,port-barton",
    body: "The San Vicente and Port Barton area offers outrigger-boat island hopping, snorkeling, reefs, sandbars and possible sea-turtle encounters. Stops often associated with the wider Port Barton circuit include German/Inaladelan Island areas, Turtle Point and reef stops such as Twin Reef, but exact itineraries vary by operator, season, sea conditions and marine rules. Wildlife sightings are never guaranteed. Use the live tour catalog for tours Marina Terrace is actually selling now and for current prices and inclusions.",
  },
  {
    id: "hardcoded-waterfalls",
    topic: "waterfalls",
    label: "Waterfalls and inland trips",
    tags: "pamuayan,bigaho,waterfall,hiking",
    body: "Pamuayan Falls near the Port Barton side and Bigaho/Ipanganan Falls in northern San Vicente are examples of inland nature trips guests may ask about. Trail condition, access fees, transport and swimming safety can change after heavy rain. TALA should frame them as excursion ideas and recommend checking current local conditions before travel.",
  },
  {
    id: "hardcoded-getting-around",
    topic: "getting-around",
    label: "Getting around Poblacion",
    tags: "tricycle,etrike,motorbike,transport",
    body: "Poblacion is compact enough that many everyday errands are nearby. Tricycles and e-trikes are common local transport, and motorbike or scooter rental may be useful for exploring farther beaches and barangays. For a rental arranged through Marina Terrace, TALA must use the live rental workflow and current rate rather than quoting a remembered amount.",
  },
  {
    id: "hardcoded-weather",
    topic: "weather",
    label: "Seasons and weather",
    tags: "weather,dry-season,wet-season,palawan",
    body: "San Vicente generally has a drier period around November through May and a wetter southwest-monsoon period around June through October, but tropical weather varies from day to day. Rainy-season travel can still include clear periods, while dry-season days can still have rain or rough seas. TALA should use current weather information for today's conditions and treat seasonal patterns only as background guidance.",
  },
  {
    id: "hardcoded-local-culture",
    topic: "local-culture",
    label: "Local communication and culture",
    tags: "culture,filipino,taglish,local",
    body: "San Vicente has the feel of a working Palawan town as well as a travel destination. English is widely usable in tourism settings. A little Filipino warmth or a natural 'po' can be friendly when appropriate, but TALA should stay clear and understandable for international guests and never turn the conversation into a caricature or forced Taglish.",
  },
  {
    id: "hardcoded-safety",
    topic: "safety",
    label: "Practical guest safety",
    tags: "safety,weather,sea,maintenance",
    body: "For current sea conditions, severe weather, electrical problems, water leaks, lock failures, medical concerns or other safety-sensitive situations, TALA should prioritize present conditions and staff help over generic destination memory. Do not encourage guests to repair resort equipment, climb to communications hardware, enter rough water, or treat an old travel guide as a live safety assessment.",
  },
];

/** Return a defensive copy so callers cannot mutate the compiled bundle. */
function marinaTerraceKnowledge(): ResortKnowledgeEntry[] {
  return MARINA_TERRACE_KNOWLEDGE.map((entry) => ({ ...entry }));
}

/**
 * Retrieve enabled knowledge for a resort.
 *
 * Marina Terrace returns immediately from Worker code: zero network round trip.
 * Other tenants use the existing scoped Supabase query.
 */
export async function getResortKnowledge(
  env: Env,
  resortId: string,
): Promise<ResortKnowledgeEntry[]> {
  const normalizedResortId = (resortId || "").trim().toLowerCase();
  if (normalizedResortId === "marina_terrace" || normalizedResortId === "marina-terrace") {
    return marinaTerraceKnowledge();
  }

  const baseRaw = env.SUPABASE_URL;
  // Knowledge read is a scoped, read-only query (resort_id + enabled) that runs
  // only inside the Worker. The anon key has no Data API grant on
  // public.tala_knowledge, so prefer the server-side service-role secret.
  const keyRaw = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const base = baseRaw ? baseRaw.replace(/^["']|["']$/g, "").trim() : "";
  const key = keyRaw ? keyRaw.replace(/^["']|["']$/g, "").trim() : "";
  if (!base || !key) {
    console.warn("[knowledge] Supabase URL/key not configured; skipping knowledge load.");
    return [];
  }

  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/tala_knowledge`);
  url.searchParams.set("select", "id,topic,label,body,tags");
  url.searchParams.set("resort_id", `eq.${resortId}`);
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("order", "sort_order.asc");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.error(`[knowledge] Supabase responded ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      topic: String(r.topic ?? ""),
      label: String(r.label ?? ""),
      body: String(r.body ?? ""),
      tags: String(r.tags ?? ""),
    }));
  } catch (err) {
    console.error("[knowledge] fetch failed:", err);
    return [];
  }
}
