"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import {
  bumpRoundHole,
  deleteRound,
  finishRound,
  isBlowUpHole,
  isScoreComplete,
  updateRoundHole,
} from "@/lib/repo";
import { Button, Card, Stepper } from "@/components/ui";
import { burstOriginFromEvent, useGolfBallBurst } from "@/components/GolfBallBurst";
import { HoleDistance } from "@/components/HoleDistance";
import type { HoleScore } from "@/types";

function toPar(total: number, par: number) {
  const diff = total - par;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export default function RoundDetail({ roundId }: { roundId: string }) {
  const router = useRouter();
  const burst = useGolfBallBurst();

  // Dexie's get() and useLiveQuery both yield undefined, so a missing round
  // would be indistinguishable from "still loading" and spin forever. Map the
  // miss to an explicit null.
  const round = useLiveQuery(async () => {
    if (typeof window === "undefined") return undefined;
    return (await requireDb().rounds.get(roundId)) ?? null;
  }, [roundId]);

  const [holeIdx, setHoleIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (round === undefined) {
    return <p className="text-cream-400">Loading…</p>;
  }
  if (round === null) {
    return <p className="text-cream-400">Round not found.</p>;
  }

  const enteredHoles = round.holeScores.filter((h) => h.strokes != null);
  const totalStrokes = enteredHoles.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const totalParEntered = enteredHoles.reduce((s, h) => s + h.par, 0);
  const blowUps = enteredHoles.filter(isBlowUpHole).length;

  const currentHole = round.holeScores[holeIdx];

  async function handleDelete() {
    if (!confirm("Delete this round? This can't be undone.")) return;
    await deleteRound(roundId);
    router.push("/rounds");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">{round.courseName}</h1>
        <p className="text-cream-400 text-sm mt-0.5">
          {round.teeName} tee · {new Date(round.date).toLocaleDateString()}
          {round.completed && <span className="ml-2 text-kelly-400">· Completed</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat
          label="Score"
          value={
            enteredHoles.length
              ? `${totalStrokes} (${toPar(totalStrokes, totalParEntered)})`
              : "—"
          }
        />
        <Stat
          label="Blow-ups"
          value={enteredHoles.length ? `${blowUps}/${enteredHoles.length}` : "—"}
        />
      </div>

      {/* Phone: one hole at a time, big targets. Desktop: full table. */}
      <div className="sm:hidden space-y-4">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => setHoleIdx((i) => Math.max(0, i - 1))}
              disabled={holeIdx === 0}
              aria-label="Previous hole"
            >
              ←
            </Button>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-cream-500">
                Hole {currentHole.number}
              </div>
              <div className="text-lg font-semibold">Par {currentHole.par}</div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setHoleIdx((i) => Math.min(17, i + 1))}
              disabled={holeIdx === 17}
              aria-label="Next hole"
            >
              →
            </Button>
          </div>

          <Stepper
            label="Strokes"
            value={currentHole.strokes}
            onSet={(v) => updateRoundHole(roundId, currentHole.number, { strokes: v })}
            onBump={(d) => bumpRoundHole(roundId, currentHole.number, "strokes", d)}
          />
        </Card>

        {/* Phone-only: a GPS yardage is a standing-on-the-course feature, and
            this is the one-hole-at-a-time view it belongs to. */}
        <HoleDistance courseId={round.courseId} holeNumber={currentHole.number} />

        <div className="grid grid-cols-9 gap-1.5">
          {round.holeScores.map((h, i) => {
            const entered = h.strokes != null;
            const vsPar = entered ? (h.strokes as number) - h.par : 0;
            return (
              <button
                key={h.number}
                onClick={() => setHoleIdx(i)}
                className={`aspect-square rounded-md text-xs font-medium flex flex-col items-center justify-center ${
                  i === holeIdx
                    ? "ring-2 ring-kelly-500 bg-pine-800"
                    : entered
                      ? vsPar > 0
                        ? "bg-red-900/50 text-red-100"
                        : vsPar < 0
                          ? "bg-kelly-800/60 text-kelly-100"
                          : "bg-pine-800 text-cream-200"
                      : "bg-pine-900 border border-pine-800 text-cream-500"
                }`}
              >
                <span className="text-[10px] text-cream-400">{h.number}</span>
                <span>{entered ? h.strokes : "–"}</span>
              </button>
            );
          })}
        </div>

        <Button variant="secondary" onClick={() => setShowAll((s) => !s)} className="w-full">
          {showAll ? "Hide full scorecard" : "Show full scorecard"}
        </Button>

        {showAll && (
          <Card className="overflow-x-auto">
            <HoleTable title="Front 9" holes={round.holeScores.slice(0, 9)} roundId={roundId} />
            <div className="h-4" />
            <HoleTable title="Back 9" holes={round.holeScores.slice(9, 18)} roundId={roundId} />
          </Card>
        )}
      </div>

      <div className="hidden sm:block space-y-5">
        <Card className="overflow-x-auto">
          <HoleTable title="Front 9" holes={round.holeScores.slice(0, 9)} roundId={roundId} />
        </Card>
        <Card className="overflow-x-auto">
          <HoleTable title="Back 9" holes={round.holeScores.slice(9, 18)} roundId={roundId} />
        </Card>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={(e) => {
            // Only the first finish is a celebration — tapping "Recalculate"
            // afterward (e.g. after fixing a hole) shouldn't repeat it.
            if (!round.completed) burst(burstOriginFromEvent(e));
            finishRound(roundId);
          }}
          className="flex-1 sm:flex-none"
        >
          {round.completed ? "Recalculate" : "Finish round"}
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {round.completed && round.differential != null && (
        <p className="text-sm text-cream-400">
          Score differential for this round:{" "}
          <span className="text-cream-100">{round.differential}</span>
        </p>
      )}
      {round.completed && round.differential == null && (
        <p className="text-sm text-amber-400/90">
          All 18 holes need a score before this round can count toward your handicap.
          {" "}
          {18 - enteredHoles.length} still missing.
        </p>
      )}
      {!round.completed && !isScoreComplete(round) && (
        <p className="text-xs text-cream-500">
          {enteredHoles.length}/18 holes entered.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-pine-800 bg-pine-900/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-cream-500">{label}</div>
      <div className="text-lg sm:text-xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function HoleTable({
  title,
  holes,
  roundId,
}: {
  title: string;
  holes: HoleScore[];
  roundId: string;
}) {
  const strokes = holes.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const par = holes.reduce((s, h) => s + h.par, 0);

  return (
    <table className="w-full text-sm min-w-[280px]">
      <caption className="text-left text-cream-400 mb-2 caption-top">
        {title} <span className="text-cream-600">· par {par}</span>
      </caption>
      <thead>
        <tr className="text-cream-500 text-xs uppercase">
          <th className="text-left font-medium py-1 pr-2">Hole</th>
          <th className="text-left font-medium py-1 pr-2">Par</th>
          <th className="text-left font-medium py-1 pr-2">Strokes</th>
        </tr>
      </thead>
      <tbody>
        {holes.map((h) => (
          <tr key={h.number} className="border-t border-pine-800">
            <td className="py-1.5 pr-2">{h.number}</td>
            <td className="py-1.5 pr-2 text-cream-400">{h.par}</td>
            <td className="py-1.5 pr-2">
              <NumberCell
                value={h.strokes}
                onChange={(v) => updateRoundHole(roundId, h.number, { strokes: v })}
              />
            </td>
          </tr>
        ))}
        <tr className="border-t border-pine-700 font-medium">
          <td className="py-1.5 pr-2">Tot</td>
          <td className="py-1.5 pr-2 text-cream-400">{par}</td>
          <td className="py-1.5 pr-2">{strokes || "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

function NumberCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))
      }
      className="w-16 bg-pine-900 border border-pine-700 rounded px-2 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-kelly-500"
    />
  );
}
