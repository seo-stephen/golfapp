"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { deleteShot, listShots, logShot } from "@/lib/repo";
import { clubStats } from "@/lib/clubAdvice";
import { Button, Card, Input, Select } from "@/components/ui";
import type { ShotResult } from "@/types";

const COMMON_CLUBS = [
  "Driver",
  "3 Wood",
  "5 Wood",
  "3 Hybrid",
  "4 Hybrid",
  "4 Iron",
  "5 Iron",
  "6 Iron",
  "7 Iron",
  "8 Iron",
  "9 Iron",
  "PW",
  "GW",
  "SW",
  "LW",
];

const RESULTS: { v: ShotResult | null; label: string }[] = [
  { v: null, label: "—" },
  { v: "green", label: "Green" },
  { v: "short", label: "Short" },
  { v: "long", label: "Long" },
  { v: "left", label: "Left" },
  { v: "right", label: "Right" },
];

function resultColor(v: ShotResult | null) {
  if (v === "green") return "bg-kelly-600 text-cream-100";
  if (v == null) return "bg-pine-800 text-cream-500";
  return "bg-amber-500/15 text-amber-300";
}

export default function YardagesPage() {
  const shots = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return listShots();
  }, [], []);

  const [club, setClub] = useState(COMMON_CLUBS[6]); // "7 Iron"
  const [distance, setDistance] = useState("");
  const [result, setResult] = useState<ShotResult | null>(null);
  const [busy, setBusy] = useState(false);

  const all = shots ?? [];

  async function handleLog() {
    const distanceYds = parseInt(distance, 10);
    if (!club.trim() || !Number.isFinite(distanceYds) || distanceYds <= 0) return;
    setBusy(true);
    try {
      await logShot({ club: club.trim(), distanceYds, result });
      setDistance("");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  // Shared with the on-course club suggestion, so both read the same averages.
  const summary = clubStats(all);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Yardages</h1>
        <p className="text-cream-400 text-sm mt-1">
          Log a shot after every range ball or approach to build your own
          club-distance reference — most beginners are guessing at this.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-cream-500">Club</span>
            <Select
              value={club}
              onChange={(e) => setClub(e.target.value)}
              className="w-full"
            >
              {COMMON_CLUBS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-cream-500">
              Distance (yds)
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full"
              placeholder="150"
            />
          </label>
        </div>

        <div>
          <span className="text-xs uppercase tracking-wide text-cream-500">
            Result (optional)
          </span>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {RESULTS.map((r) => (
              <button
                key={String(r.v)}
                type="button"
                onClick={() => setResult(r.v)}
                className={`min-h-11 px-3 rounded-full text-sm font-medium ${
                  result === r.v ? resultColor(r.v) : "bg-pine-800 text-cream-400"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleLog} disabled={busy || !distance} className="w-full sm:w-auto">
          Log shot
        </Button>
      </Card>

      {summary.length > 0 && (
        <Card className="overflow-x-auto">
          <h2 className="font-medium mb-3">Your yardage book</h2>
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-cream-500 text-xs uppercase">
                <th className="text-left font-medium py-1 pr-2">Club</th>
                <th className="text-left font-medium py-1 pr-2">Avg</th>
                <th className="text-left font-medium py-1 pr-2">Range</th>
                <th className="text-left font-medium py-1 pr-2">Shots</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.club} className="border-t border-pine-800">
                  <td className="py-1.5 pr-2 font-medium">{row.club}</td>
                  <td className="py-1.5 pr-2 text-kelly-400 font-semibold">
                    {row.avgYds} yds
                  </td>
                  <td className="py-1.5 pr-2 text-cream-400">
                    {row.minYds}–{row.maxYds}
                  </td>
                  <td className="py-1.5 pr-2 text-cream-400">{row.shots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-3">Recent shots</h2>
        {all.length === 0 ? (
          <p className="text-sm text-cream-500">
            No shots logged yet. Your next range session is a good time to start.
          </p>
        ) : (
          <ul className="divide-y divide-pine-800">
            {all.slice(0, 15).map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{s.club}</span>{" "}
                  <span className="text-cream-400">{s.distanceYds} yds</span>
                  {s.result && (
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${resultColor(s.result)}`}
                    >
                      {s.result}
                    </span>
                  )}
                  <div className="text-[11px] text-cream-600">
                    {new Date(s.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <button
                  onClick={() => deleteShot(s.id)}
                  aria-label="Delete shot"
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
