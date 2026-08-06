"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { MIN_ROUNDS_FOR_INDEX, computeHandicapIndex } from "@/lib/handicap";
import { isScoreComplete, totalStrokesFor } from "@/lib/repo";
import { Button, Card, StatTile } from "@/components/ui";

export default function Dashboard() {
  const rounds = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return requireDb().rounds.orderBy("date").toArray();
  }, [], []);

  const swingCount = useLiveQuery(async () => {
    if (typeof window === "undefined") return 0;
    return requireDb().swingSessions.count();
  }, [], 0);

  const all = rounds ?? [];
  const completed = all.filter((r) => r.completed);
  const inProgress = all.filter((r) => !r.completed);
  const recent = [...all].reverse().slice(0, 5);

  const handicap = computeHandicapIndex(
    completed.filter((r) => r.differential != null).map((r) => r.differential as number)
  );

  // Only full 18-hole rounds, so part-entered rounds don't count their missing
  // holes as 0 strokes.
  const fullRounds = completed.filter(isScoreComplete);
  const avgScore = fullRounds.length
    ? Math.round(
        (fullRounds.reduce((s, r) => s + totalStrokesFor(r), 0) / fullRounds.length) * 10
      ) / 10
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Welcome to Bogey<span className="text-kelly-400">Boys</span>
          </h1>
          <p className="text-cream-400 text-sm mt-1">
            Track your rounds, watch your handicap move, and analyze your swing.
          </p>
        </div>
        <Link href="/round/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Start a round</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile
          label="Handicap index"
          value={handicap ?? "—"}
          sub={handicap == null ? `after ${MIN_ROUNDS_FOR_INDEX} rounds` : undefined}
        />
        <StatTile label="Rounds played" value={completed.length} />
        <StatTile label="Scoring avg" value={avgScore ?? "—"} />
        <StatTile label="Swings analyzed" value={swingCount ?? 0} />
      </div>

      {/* Resume is the most important control on this page. iOS reloads a Home
          Screen app to its start_url after it has been backgrounded, so every
          time the phone locks mid-round the golfer lands back here. */}
      {inProgress.length > 0 && (
        <Card className="border-kelly-600/50 bg-kelly-500/5">
          <h2 className="font-medium mb-3">Continue your round</h2>
          <ul className="space-y-2">
            {inProgress.map((r) => {
              const played = r.holeScores.filter((h) => h.strokes != null).length;
              const nextHole =
                r.holeScores.find((h) => h.strokes == null)?.number ?? 18;
              return (
                <li key={r.id}>
                  <Link
                    href={`/round?id=${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-kelly-600 active:bg-kelly-700 sm:hover:bg-kelly-500 text-white px-4 py-3 min-h-14"
                  >
                    <span className="font-medium">{r.courseName}</span>
                    <span className="text-sm text-kelly-50/90 text-right shrink-0">
                      {played === 0 ? "Start hole 1" : `Hole ${nextHole} · ${played}/18`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-medium mb-3">Recent rounds</h2>
          <ul className="divide-y divide-pine-800">
            {recent.map((r) => {
              const strokes = r.holeScores.reduce((s, h) => s + (h.strokes ?? 0), 0);
              return (
                <li key={r.id} className="py-2">
                  <Link
                    href={`/round?id=${r.id}`}
                    className="flex justify-between text-sm hover:text-kelly-400"
                  >
                    <span>{r.courseName}</span>
                    <span className="text-cream-400">{strokes || "—"}</span>
                  </Link>
                </li>
              );
            })}
            {recent.length === 0 && (
              <p className="text-sm text-cream-500 py-2">
                No rounds yet. Add a course on the{" "}
                <Link href="/courses" className="text-kelly-400 underline">
                  Courses
                </Link>{" "}
                page, then start a round.
              </p>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="font-medium mb-3">Swing trainer</h2>
          <p className="text-sm text-cream-400">
            Prop your phone up side-on and record a swing. Tempo, spine tilt, and head
            sway are estimated on-device — nothing is uploaded.
          </p>
          <Link href="/swing" className="inline-block mt-3">
            <Button variant="secondary">Open swing analysis</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
