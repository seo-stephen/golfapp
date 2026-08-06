"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { MIN_ROUNDS_FOR_INDEX, computeHandicapIndex } from "@/lib/handicap";
import { isBlowUpHole, isScoreComplete, totalStrokesFor } from "@/lib/repo";
import { Card, StatTile } from "@/components/ui";
import { TrendChart } from "@/components/TrendChart";

export default function StatsPage() {
  const rounds = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    const all = await requireDb().rounds.orderBy("date").toArray();
    return all.filter((r) => r.completed);
  }, [], []);

  const completed = rounds ?? [];

  const differentials = completed
    .filter((r) => r.differential != null)
    .map((r) => r.differential as number);

  const currentHandicap = computeHandicapIndex(differentials);

  // The index is null until MIN_ROUNDS_FOR_INDEX rounds exist, so the first
  // rounds contribute no point — coercing null to 0 would plot a fake scratch
  // handicap.
  const handicapTrend = completed
    .filter((r) => r.differential != null)
    .map((r, i, arr) => ({
      label: new Date(r.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: computeHandicapIndex(
        arr.slice(0, i + 1).map((x) => x.differential as number)
      ),
    }))
    .filter((p): p is { label: string; value: number } => p.value != null);

  // Scoring average only makes sense over rounds with all 18 holes entered —
  // a part-entered round would count its missing holes as 0 strokes and drag
  // the average down.
  const fullRounds = completed.filter(isScoreComplete);

  const scoreTrend = fullRounds.map((r) => ({
    label: new Date(r.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    value: totalStrokesFor(r),
  }));

  const avgScore = fullRounds.length
    ? Math.round(
        (fullRounds.reduce((s, r) => s + totalStrokesFor(r), 0) / fullRounds.length) * 10
      ) / 10
    : null;

  const allHoles = completed.flatMap((r) => r.holeScores);
  const fairwayEligible = allHoles.filter((h) => h.par !== 3 && h.fairwayHit != null);
  const fairwayPct = fairwayEligible.length
    ? Math.round(
        (fairwayEligible.filter((h) => h.fairwayHit).length / fairwayEligible.length) * 100
      )
    : null;

  const girEligible = allHoles.filter((h) => h.gir != null);
  const girPct = girEligible.length
    ? Math.round((girEligible.filter((h) => h.gir).length / girEligible.length) * 100)
    : null;

  // The single biggest lever for breaking 90 as a beginner: cutting down
  // double-bogey-or-worse holes matters more than incremental GIR gains.
  const blowUpEligible = allHoles.filter((h) => h.strokes != null);
  const blowUpPct = blowUpEligible.length
    ? Math.round(
        (blowUpEligible.filter(isBlowUpHole).length / blowUpEligible.length) * 100
      )
    : null;

  const fullyPenaltyLogged = completed.filter(
    (r) => r.holeScores.length > 0 && r.holeScores.every((h) => h.penalties != null)
  );
  const avgPenalties = fullyPenaltyLogged.length
    ? Math.round(
        (fullyPenaltyLogged.reduce(
          (s, r) => s + r.holeScores.reduce((ps, h) => ps + (h.penalties ?? 0), 0),
          0
        ) /
          fullyPenaltyLogged.length) *
          10
      ) / 10
    : null;

  // Per-round putting average is only comparable across rounds where putts were
  // recorded on every hole; a round with two holes logged is not a "round".
  const fullyPutted = completed.filter(
    (r) => r.holeScores.length > 0 && r.holeScores.every((h) => h.putts != null)
  );
  const avgPutts = fullyPutted.length
    ? Math.round(
        (fullyPutted.reduce(
          (s, r) => s + r.holeScores.reduce((ps, h) => ps + (h.putts ?? 0), 0),
          0
        ) /
          fullyPutted.length) *
          10
      ) / 10
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="text-cream-400 text-sm mt-1">
          Based on {completed.length} completed round{completed.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <StatTile
          label="Handicap index"
          value={currentHandicap ?? "—"}
          sub={
            currentHandicap == null
              ? `needs ${MIN_ROUNDS_FOR_INDEX} rounds (${completed.length} so far)`
              : undefined
          }
        />
        <StatTile label="Scoring avg" value={avgScore ?? "—"} />
        <StatTile
          label="Blow-up holes"
          value={blowUpPct != null ? `${blowUpPct}%` : "—"}
          sub="double bogey or worse"
        />
        <StatTile label="Fairways hit" value={fairwayPct != null ? `${fairwayPct}%` : "—"} />
        <StatTile label="GIR" value={girPct != null ? `${girPct}%` : "—"} />
        <StatTile label="Putts / round" value={avgPutts ?? "—"} />
        <StatTile label="Penalties / round" value={avgPenalties ?? "—"} />
      </div>

      <Card>
        <h2 className="font-medium mb-2">Handicap index over time</h2>
        <TrendChart data={handicapTrend} formatValue={(v) => v.toFixed(1)} />
      </Card>

      <Card>
        <h2 className="font-medium mb-2">Scoring trend</h2>
        <TrendChart data={scoreTrend} formatValue={(v) => String(v)} />
      </Card>

      {completed.length === 0 && (
        <p className="text-sm text-cream-500">
          Finish a round to start seeing stats here.
        </p>
      )}
    </div>
  );
}
