// ---------------------------------------------------------------------------
// Live weather for San Vicente, Palawan — Open-Meteo (no API key, free,
// generous rate limits), fetched client-side from the admin console.
// Not baked into the stored briefing text (that's generated in Postgres by
// the pg_cron job, which can't easily make an HTTP call) — this is a live
// "right now" read shown alongside it.
// ---------------------------------------------------------------------------

const SAN_VICENTE_LAT = 10.1362;
const SAN_VICENTE_LON = 119.3611;

export interface WeatherNow {
  tempC: number;
  windKph: number;
  code: number;
  description: string;
  isDay: boolean;
}

// WMO weather codes (https://open-meteo.com/en/docs) collapsed to short labels.
const WMO_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export async function fetchSanVicenteWeather(): Promise<WeatherNow | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${SAN_VICENTE_LAT}&longitude=${SAN_VICENTE_LON}` +
      `&current=temperature_2m,wind_speed_10m,weather_code,is_day&timezone=Asia%2FManila`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const current = json?.current;
    if (!current) return null;
    const code = Number(current.weather_code ?? 0);
    return {
      tempC: Number(current.temperature_2m ?? 0),
      windKph: Number(current.wind_speed_10m ?? 0),
      code,
      description: WMO_LABELS[code] ?? "—",
      isDay: current.is_day === 1,
    };
  } catch {
    return null;
  }
}
