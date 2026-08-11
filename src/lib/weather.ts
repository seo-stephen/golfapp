// Open-Meteo: free, no API key, CORS-enabled — unlike GolfCourseAPI this needs
// no server-side secret, so it's called directly from the client, in keeping
// with the app's "nothing uploaded, nothing but the browser" design.
const GEOCODE_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

// Metric units (Celsius, km/h) — Open-Meteo's own defaults, passed explicitly
// for clarity at the call site below.
const FORECAST_DAYS = 7;

export interface GeoResult {
  name: string;
  admin1?: string; // state/province
  country?: string;
  latitude: number;
  longitude: number;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD, in the location's own timezone
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  /** Open-Meteo omits this for some locations/ranges. */
  precipitationProbabilityMax: number | null;
  windSpeedMaxKmh: number;
}

export type GolfDayLabel = "great" | "good" | "marginal" | "poor";

export interface GolfDayScore {
  score: number; // 0-100
  label: GolfDayLabel;
}

export interface GolfForecastDay {
  forecast: DailyForecast;
  golf: GolfDayScore;
}

interface GeocodeApiResult {
  name?: string;
  admin1?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface GeocodeApiResponse {
  results?: GeocodeApiResult[];
}

interface ForecastApiResponse {
  daily?: {
    time?: string[];
    weathercode?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: (number | null)[];
    windspeed_10m_max?: number[];
  };
}

export async function geocodeLocation(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: "5",
    language: "en",
    format: "json",
  });
  const res = await fetch(`${GEOCODE_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Location search failed with status ${res.status}`);
  }
  const data: GeocodeApiResponse = await res.json();

  return (data.results ?? [])
    .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number" && r.name)
    .map((r) => ({
      name: r.name as string,
      admin1: r.admin1,
      country: r.country,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
    }));
}

export async function fetchForecast(
  latitude: number,
  longitude: number
): Promise<DailyForecast[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily:
      "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max",
    temperature_unit: "celsius",
    windspeed_unit: "kmh",
    timezone: "auto",
    forecast_days: String(FORECAST_DAYS),
  });
  const res = await fetch(`${FORECAST_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Forecast request failed with status ${res.status}`);
  }
  const data: ForecastApiResponse = await res.json();
  const daily = data.daily;
  if (!daily?.time) return [];

  return daily.time.map((date, i) => ({
    date,
    weatherCode: daily.weathercode?.[i] ?? 0,
    tempMaxC: daily.temperature_2m_max?.[i] ?? 0,
    tempMinC: daily.temperature_2m_min?.[i] ?? 0,
    precipitationProbabilityMax: daily.precipitation_probability_max?.[i] ?? null,
    windSpeedMaxKmh: daily.windspeed_10m_max?.[i] ?? 0,
  }));
}

// WMO weather codes that make a round unplayable regardless of temp/wind —
// thunderstorms and anything snowing rule out golf outright, so no amount of
// low wind or mild temperature should be able to outscore them.
const SEVERE_CODES = new Set([71, 73, 75, 77, 85, 86, 95, 96, 99]);

const WEATHER_CODE_INFO: Record<number, { emoji: string; label: string }> = {
  0: { emoji: "☀️", label: "Clear" },
  1: { emoji: "🌤️", label: "Mostly clear" },
  2: { emoji: "⛅", label: "Partly cloudy" },
  3: { emoji: "☁️", label: "Overcast" },
  45: { emoji: "🌫️", label: "Fog" },
  48: { emoji: "🌫️", label: "Fog" },
  51: { emoji: "🌦️", label: "Light drizzle" },
  53: { emoji: "🌦️", label: "Drizzle" },
  55: { emoji: "🌧️", label: "Heavy drizzle" },
  56: { emoji: "🌧️", label: "Freezing drizzle" },
  57: { emoji: "🌧️", label: "Freezing drizzle" },
  61: { emoji: "🌦️", label: "Light rain" },
  63: { emoji: "🌧️", label: "Rain" },
  65: { emoji: "🌧️", label: "Heavy rain" },
  66: { emoji: "🌧️", label: "Freezing rain" },
  67: { emoji: "🌧️", label: "Freezing rain" },
  71: { emoji: "🌨️", label: "Light snow" },
  73: { emoji: "🌨️", label: "Snow" },
  75: { emoji: "❄️", label: "Heavy snow" },
  77: { emoji: "❄️", label: "Snow grains" },
  80: { emoji: "🌦️", label: "Rain showers" },
  81: { emoji: "🌧️", label: "Rain showers" },
  82: { emoji: "🌧️", label: "Violent rain showers" },
  85: { emoji: "🌨️", label: "Snow showers" },
  86: { emoji: "❄️", label: "Snow showers" },
  95: { emoji: "⛈️", label: "Thunderstorm" },
  96: { emoji: "⛈️", label: "Thunderstorm w/ hail" },
  99: { emoji: "⛈️", label: "Thunderstorm w/ hail" },
};

export function describeWeatherCode(code: number): { emoji: string; label: string } {
  return WEATHER_CODE_INFO[code] ?? { emoji: "❔", label: "Unknown" };
}

export const GOLF_SCORE_THRESHOLDS = {
  great: 75,
  good: 55,
  marginal: 35,
} as const;

/**
 * A transparent, tunable score — not a meteorological model. Rain chance
 * dominates (a round is 4+ hours outdoors), wind and temperature only
 * penalize once they cross a threshold most golfers would actually notice.
 */
export function scoreGolfDay(day: DailyForecast): GolfDayScore {
  let score: number;

  if (SEVERE_CODES.has(day.weatherCode)) {
    score = 0;
  } else {
    score = 100;

    const precip = day.precipitationProbabilityMax ?? 0;
    score -= precip * 0.6;

    if (day.windSpeedMaxKmh > 24) {
      score -= (day.windSpeedMaxKmh - 24) * 1.25;
    }

    if (day.tempMaxC < 10) {
      score -= (10 - day.tempMaxC) * 3.5;
    } else if (day.tempMaxC > 30) {
      score -= (day.tempMaxC - 30) * 3.5;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
  }

  const label: GolfDayLabel =
    score >= GOLF_SCORE_THRESHOLDS.great
      ? "great"
      : score >= GOLF_SCORE_THRESHOLDS.good
        ? "good"
        : score >= GOLF_SCORE_THRESHOLDS.marginal
          ? "marginal"
          : "poor";

  return { score, label };
}

export function rankGolfDays(days: DailyForecast[]): GolfForecastDay[] {
  return days.map((forecast) => ({ forecast, golf: scoreGolfDay(forecast) }));
}

export interface NextGoodDay {
  day: GolfForecastDay;
  /** False when nothing in range clears the "good" bar — `day` is the best of a bad bunch. */
  meetsThreshold: boolean;
}

export function findNextGoodDay(days: DailyForecast[]): NextGoodDay | null {
  const ranked = rankGolfDays(days);
  if (ranked.length === 0) return null;

  const firstGood = ranked.find((d) => d.golf.score >= GOLF_SCORE_THRESHOLDS.good);
  if (firstGood) return { day: firstGood, meetsThreshold: true };

  const best = ranked.reduce((a, b) => (b.golf.score > a.golf.score ? b : a));
  return { day: best, meetsThreshold: false };
}

const STORAGE_KEY = "bogeyboys.weatherLocation";

/** Local-only preference — same "nothing leaves the device" rule as everything else. */
export function loadSavedLocation(): GeoResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoResult;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocation(location: GeoResult): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
}

export function clearSavedLocation(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
