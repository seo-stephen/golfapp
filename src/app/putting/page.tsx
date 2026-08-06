"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { deletePuttingSession, listPuttingSessions, logPuttingSession } from "@/lib/repo";
import { Button, Card, Stepper, StatTile } from "@/components/ui";
import { TrendChart } from "@/components/TrendChart";

const QUICK_DISTANCES = [3, 4, 5, 6, 8, 10];

function pct(makes: number, attempts: number) {
  return attempts ? Math.round((makes / attempts) * 1000) / 10 : 0;
}

export default function PuttingPage() {
  const sessions = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return listPuttingSessions();
  }, [], []);

  const all = sessions ?? [];

  const [distance, setDistance] = useState(4);
  const [made, setMade] = useState(0);
  const [missed, setMissed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);

  const attempts = made + missed;

  async function handleSave() {
    if (attempts === 0) return;
    setBusy(true);
    try {
      await logPuttingSession({ distanceFt: distance, attempts, makes: made });
      setStatus(`Logged ${made}/${attempts} (${pct(made, attempts)}%) from ${distance} ft.`);
      setMade(0);
      setMissed(0);
    } finally {
      setBusy(false);
    }
  }

  // Per-distance rollup, closest putts first — reads like a stats sheet, not
  // a club-selection reference, so ascending distance beats sorting by %.
  const byDistance = new Map<number, typeof all>();
  for (const s of all) {
    byDistance.set(s.distanceFt, [...(byDistance.get(s.distanceFt) ?? []), s]);
  }
  const distances = [...byDistance.keys()].sort((a, b) => a - b);
  const summary = distances.map((d) => {
    const rows = byDistance.get(d) ?? [];
    const totalAttempts = rows.reduce((s, r) => s + r.attempts, 0);
    const totalMakes = rows.reduce((s, r) => s + r.makes, 0);
    return {
      distance: d,
      sessions: rows.length,
      attempts: totalAttempts,
      makes: totalMakes,
      pct: pct(totalMakes, totalAttempts),
    };
  });

  const totalAttempts = all.reduce((s, r) => s + r.attempts, 0);
  const totalMakes = all.reduce((s, r) => s + r.makes, 0);

  const activeDistance = selectedDistance ?? distances[0] ?? null;
  const chartData = (activeDistance != null ? byDistance.get(activeDistance) ?? [] : [])
    .slice()
    .sort((a, b) => a.date - b.date)
    .map((s) => ({
      label: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: pct(s.makes, s.attempts),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Putting</h1>
        <p className="text-cream-400 text-sm mt-1">
          Log every mat session — made % by distance is the number that actually
          predicts fewer 3-putts on the course.
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <span className="text-xs uppercase tracking-wide text-cream-500">
            Distance (ft)
          </span>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {QUICK_DISTANCES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDistance(d)}
                className={`min-h-11 min-w-11 px-3 rounded-full text-sm font-medium ${
                  distance === d
                    ? "bg-kelly-600 text-cream-100"
                    : "bg-pine-800 text-cream-400"
                }`}
              >
                {d}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={distance}
              onChange={(e) => setDistance(Math.max(1, parseInt(e.target.value, 10) || 1))}
              aria-label="Custom distance in feet"
              className="w-16 text-center bg-pine-900 border-2 border-pine-700 rounded-xl min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-kelly-500"
            />
          </div>
        </div>

        <Stepper
          label="Made"
          value={made}
          onSet={(v) => setMade(v ?? 0)}
          onBump={(d) => setMade((m) => Math.max(0, m + d))}
        />
        <Stepper
          label="Missed"
          value={missed}
          onSet={(v) => setMissed(v ?? 0)}
          onBump={(d) => setMissed((m) => Math.max(0, m + d))}
        />

        <p className="text-sm text-cream-400">
          This session: <span className="text-cream-100">{made}/{attempts}</span>{" "}
          {attempts > 0 && <span className="text-kelly-400">({pct(made, attempts)}%)</span>}
        </p>

        <Button onClick={handleSave} disabled={busy || attempts === 0} className="w-full sm:w-auto">
          Save session
        </Button>

        {status && <p className="text-sm text-kelly-400">{status}</p>}
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="Sessions" value={all.length || "—"} />
        <StatTile label="Total putts" value={totalAttempts || "—"} />
        <StatTile
          label="Overall made"
          value={totalAttempts ? `${pct(totalMakes, totalAttempts)}%` : "—"}
        />
      </div>

      {summary.length > 0 && (
        <Card className="overflow-x-auto">
          <h2 className="font-medium mb-3">By distance</h2>
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-cream-500 text-xs uppercase">
                <th className="text-left font-medium py-1 pr-2">Distance</th>
                <th className="text-left font-medium py-1 pr-2">Made %</th>
                <th className="text-left font-medium py-1 pr-2">Putts</th>
                <th className="text-left font-medium py-1 pr-2">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.distance} className="border-t border-pine-800">
                  <td className="py-1.5 pr-2 font-medium">{row.distance} ft</td>
                  <td className="py-1.5 pr-2 text-kelly-400 font-semibold">{row.pct}%</td>
                  <td className="py-1.5 pr-2 text-cream-400">
                    {row.makes}/{row.attempts}
                  </td>
                  <td className="py-1.5 pr-2 text-cream-400">{row.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {distances.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-medium">Made % over time</h2>
            <div className="flex gap-1.5">
              {distances.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDistance(d)}
                  className={`min-h-9 px-3 rounded-full text-xs font-medium ${
                    activeDistance === d
                      ? "bg-kelly-500/20 text-kelly-300"
                      : "bg-pine-800 text-cream-400"
                  }`}
                >
                  {d} ft
                </button>
              ))}
            </div>
          </div>
          <TrendChart data={chartData} formatValue={(v) => `${v}%`} />
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-3">Recent sessions</h2>
        {all.length === 0 ? (
          <p className="text-sm text-cream-500">
            No sessions logged yet. Your putting mat is waiting.
          </p>
        ) : (
          <ul className="divide-y divide-pine-800">
            {all.slice(0, 15).map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{s.distanceFt} ft</span>{" "}
                  <span className="text-cream-400">
                    {s.makes}/{s.attempts}
                  </span>{" "}
                  <span className="text-kelly-400">({pct(s.makes, s.attempts)}%)</span>
                  <div className="text-[11px] text-cream-600">
                    {new Date(s.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <button
                  onClick={() => deletePuttingSession(s.id)}
                  aria-label="Delete session"
                  className="text-cream-500 hover:text-red-400 text-sm px-2 min-h-11"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
