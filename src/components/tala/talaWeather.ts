// ---------------------------------------------------------------------------
// TALA Weather Context
//
// Fetches current weather for San Vicente, Palawan using OpenWeatherMap free API.
// Provides weather-aware suggestions to TALA (e.g., "It's sunny — perfect for the beach!").
// Falls back gracefully if API key is missing or request fails.
// ---------------------------------------------------------------------------

export interface WeatherData {
  temp: number;        // Celsius
  feelsLike: number;   // Celsius
  condition: string;   // e.g. "Clear", "Clouds", "Rain"
  description: string; // e.g. "clear sky", "light rain"
  humidity: number;    // percentage
  windSpeed: number;   // m/s
  icon: string;        // OpenWeatherMap icon code
}

export interface WeatherContext {
  weather: WeatherData | null;
  suggestion: string | null;
  fetchedAt: string;
}

const SAN_VICENTE_LAT = 10.5293;
const SAN_VICENTE_LON = 119.2756;
const CACHE_KEY = "tala_weather_cache";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached weather if still fresh.
 */
function getCached(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(data: WeatherData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    /* storage full — not critical */
  }
}

/**
 * Fetch current weather from OpenWeatherMap.
 * Requires an API key stored in localStorage under key `openweathermap_api_key`.
 * Free tier: 1,000 calls/day — more than enough for TALA.
 */
export async function fetchWeather(apiKey?: string): Promise<WeatherData | null> {
  const key = apiKey || localStorage.getItem("openweathermap_api_key");
  if (!key) return null;

  // Check cache first
  const cached = getCached();
  if (cached) return cached;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${SAN_VICENTE_LAT}&lon=${SAN_VICENTE_LON}&units=metric&appid=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const weather: WeatherData = {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      condition: data.weather[0]?.main ?? "Unknown",
      description: data.weather[0]?.description ?? "unknown",
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed ?? 0,
      icon: data.weather[0]?.icon ?? "01d",
    };

    setCache(weather);
    return weather;
  } catch {
    return null;
  }
}

/**
 * Generate a weather-aware suggestion string for TALA to include in responses.
 */
export function weatherSuggestion(weather: WeatherData): string {
  const { temp, condition, humidity, windSpeed } = weather;
  const hour = new Date().getHours();
  const isMorning = hour >= 6 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEvening = hour >= 17 && hour < 20;

  // Rain
  if (condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm") {
    return `It's ${condition.toLowerCase()} right now (${temp}°C). Suggest indoor activities — co-working space, cafe, or relaxation at the lodge.`;
  }

  // Hot
  if (temp >= 32) {
    return `It's hot today (${temp}°C, feels like ${weather.feelsLike}°C). Suggest staying hydrated, the pool, or the beach. Remind about sunscreen.`;
  }

  // Cool/pleasant
  if (temp <= 24) {
    return `Pleasant weather (${temp}°C). Perfect for outdoor activities — motorbike tour, hiking, or beach time.`;
  }

  // Windy
  if (windSpeed > 8) {
    return `Windy conditions (${windSpeed} m/s). Good for kitesurfing but may affect island hopping. Mention accordingly.`;
  }

  // Default sunny/clear
  if (condition === "Clear") {
    if (isMorning) return `Beautiful clear morning (${temp}°C). Suggest sunrise activity or breakfast outdoors.`;
    if (isAfternoon) return `Sunny afternoon (${temp}°C). Perfect for the beach or pool. Mention sunset session later.`;
    if (isEvening) return `Nice evening (${temp}°C). Sunset session happening — mention it.`;
    return `Clear skies (${temp}°C). Great weather for any activity.`;
  }

  // Cloudy
  if (condition === "Clouds") {
    return `Cloudy but dry (${temp}°C). Good for exploring — not too hot. Suggest motorbike rental or town walk.`;
  }

  // Mist/fog (common in Palawan mornings)
  if (condition === "Mist" || condition === "Fog") {
    return `Misty conditions (${temp}°C). Usually clears by mid-morning. Suggest patience or indoor co-working for now.`;
  }

  return `Current weather: ${condition}, ${temp}°C. Factor this into activity suggestions.`;
}

/**
 * Build full weather context for TALA system prompt injection.
 */
export async function buildWeatherContext(apiKey?: string): Promise<WeatherContext> {
  const weather = await fetchWeather(apiKey);
  const fetchedAt = new Date().toISOString();

  if (!weather) {
    return { weather: null, suggestion: null, fetchedAt };
  }

  return {
    weather,
    suggestion: weatherSuggestion(weather),
    fetchedAt,
  };
}
