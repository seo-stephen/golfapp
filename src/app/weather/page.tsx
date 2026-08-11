"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import {
  describeWeatherCode,
  fetchForecast,
  findNextGoodDay,
  geocodeLocation,
  loadSavedLocation,
  rankGolfDays,
  saveLocation,
  type DailyForecast,
  type GeoResult,
  type GolfDayLabel,
} from "@/lib/weather";

const LABEL_STYLES: Record<GolfDayLabel, string> = {
  great: "text-kelly-400",
  good: "text-kelly-300",
  marginal: "text-amber-400/90",
  poor: "text-red-400",
};

const LABEL_TEXT: Record<GolfDayLabel, string> = {
  great: "Great for golf",
  good: "Good for golf",
  marginal: "Playable, but check conditions",
  poor: "Not a golf day",
};

function locationDisplay(loc: GeoResult): string {
  return [loc.name, loc.admin1, loc.country].filter(Boolean).join(", ");
}

function formatDate(dateStr: string): string {
  // Daily dates come back as YYYY-MM-DD with no time — parsing that directly
  // with `new Date()` reads it as UTC midnight, which rolls back a day in any
  // timezone west of UTC. Split and construct in local time instead.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function LocationPicker({
  onSelect,
}: {
  onSelect: (loc: GeoResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setError(null);
    try {
      const found = await geocodeLocation(trimmed);
      setResults(found);
      if (found.length === 0) setError("No matching locations. Try a nearby larger city.");
    } catch {
      setError("Couldn't reach location search — you may be offline.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-medium">Set your location</h2>
        <p className="text-sm text-cream-400 mt-1">
          Search a city to see its golf-day forecast.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <Input
          type="search"
          enterKeyHint="search"
          autoCapitalize="words"
          placeholder="Toronto, Denver, Edinburgh…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-0"
        />
        <Button type="submit" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-pine-800">
          {results.map((loc, i) => (
            <li key={i} className="py-2">
              <button
                type="button"
                onClick={() => onSelect(loc)}
                className="w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-pine-800 flex items-center justify-between gap-2"
              >
                <span>{locationDisplay(loc)}</span>
                <span className="text-kelly-400 text-sm shrink-0">Select</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function WeatherPage() {
  // Lazy initializer, not an effect: this is a client-only page, so reading
  // localStorage during the first render is safe and avoids an extra render
  // pass just to populate state that's already known.
  const [location, setLocation] = useState<GeoResult | null>(() => loadSavedLocation());
  const [changingLocation, setChangingLocation] = useState(false);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    const loc = location;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const days = await fetchForecast(loc.latitude, loc.longitude);
        if (!cancelled) setForecast(days);
      } catch {
        if (!cancelled) setError("Couldn't reach the forecast — you may be offline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [location]);

  function handleSelectLocation(loc: GeoResult) {
    saveLocation(loc);
    setLocation(loc);
    setChangingLocation(false);
    setForecast(null);
  }

  const nextGoodDay = forecast ? findNextGoodDay(forecast) : null;
  const ranked = forecast ? rankGolfDays(forecast) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Golf Weather</h1>
        <p className="text-cream-400 text-sm mt-1">
          Pick a location and see the next day worth playing.
        </p>
      </div>

      {(!location || changingLocation) && <LocationPicker onSelect={handleSelectLocation} />}

      {location && !changingLocation && (
        <>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-kelly-400 font-bold">
                Location
              </div>
              <div className="font-medium mt-0.5">{locationDisplay(location)}</div>
            </div>
            <Button variant="secondary" onClick={() => setChangingLocation(true)}>
              Change
            </Button>
          </Card>

          {loading && <p className="text-sm text-cream-500">Loading forecast…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {nextGoodDay && (
            <Card className={nextGoodDay.meetsThreshold ? "border-kelly-600/50 bg-kelly-500/5" : ""}>
              <h2 className="font-medium mb-3">
                {nextGoodDay.meetsThreshold ? "Next good day to play" : "Best of the next 7 days"}
              </h2>
              {!nextGoodDay.meetsThreshold && (
                <p className="text-sm text-amber-400/90 mb-3">
                  Nothing in the next 7 days clears the bar for a great round — here&apos;s the
                  least bad option.
                </p>
              )}
              <div className="flex items-center gap-4">
                <span className="text-4xl" aria-hidden>
                  {describeWeatherCode(nextGoodDay.day.forecast.weatherCode).emoji}
                </span>
                <div>
                  <div className="text-lg font-semibold">
                    {formatDate(nextGoodDay.day.forecast.date)}
                  </div>
                  <div className={`text-sm font-medium ${LABEL_STYLES[nextGoodDay.day.golf.label]}`}>
                    {LABEL_TEXT[nextGoodDay.day.golf.label]} · {nextGoodDay.day.golf.score}/100
                  </div>
                  <div className="text-sm text-cream-400 mt-0.5">
                    {Math.round(nextGoodDay.day.forecast.tempMaxF)}° /{" "}
                    {Math.round(nextGoodDay.day.forecast.tempMinF)}°F · wind up to{" "}
                    {Math.round(nextGoodDay.day.forecast.windSpeedMaxMph)} mph ·{" "}
                    {nextGoodDay.day.forecast.precipitationProbabilityMax ?? 0}% rain chance
                  </div>
                </div>
              </div>
            </Card>
          )}

          {ranked.length > 0 && (
            <Card>
              <h2 className="font-medium mb-3">7-day outlook</h2>
              <ul className="divide-y divide-pine-800">
                {ranked.map(({ forecast: f, golf }) => (
                  <li key={f.date} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl" aria-hidden>
                        {describeWeatherCode(f.weatherCode).emoji}
                      </span>
                      <div>
                        <div className="text-sm font-medium">{formatDate(f.date)}</div>
                        <div className="text-xs text-cream-500">
                          {Math.round(f.tempMaxF)}° / {Math.round(f.tempMinF)}°F ·{" "}
                          {f.precipitationProbabilityMax ?? 0}% rain
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-tight ${LABEL_STYLES[golf.label]}`}>
                      {golf.score}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
