"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import {
  bumpRoundHole,
  deleteRound,
  finishRound,
  isScoreComplete,
  updateRoundHole,
} from "@/lib/repo";
import { Button, Card } from "@/components/ui";
import type { HoleScore } from "@/types";

function toPar(total: number, par: number) {
  const diff = total - par;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export default function RoundDetail({ roundId }: { roundId: string }) {
  const router = useRouter();

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
  const totalPutts = round.holeScores.reduce((s, h) => s + (h.putts ?? 0), 0);

  const fairwayEligible = round.holeScores.filter((h) => h.par !== 3);
  const fairwaysHit = fairwayEligible.filter((h) => h.fairwayHit === true).length;
  const fairwaysRecorded = fairwayEligible.filter((h) => h.fairwayHit != null).length;

  const girHit = round.holeScores.filter((h) => h.gir === true).length;
  const girRecorded = round.holeScores.filter((h) => h.gir != null).length;

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat
          label="Score"
          value={
            enteredHoles.length
              ? `${totalStrokes} (${toPar(totalStrokes, totalParEntered)})`
              : "—"
          }
        />
        <Stat label="Putts" value={totalPutts || "—"} />
        <Stat
          label="Fairways"
          value={fairwaysRecorded ? `${fairwaysHit}/${fairwaysRecorded}` : "—"}
        />
        <Stat label="GIR" value={girRecorded ? `${girHit}/${girRecorded}` : "—"} />
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

          <StepperRow
            label="Strokes"
            value={currentHole.strokes}
            onSet={(v) => updateRoundHole(roundId, currentHole.number, { strokes: v })}
            onBump={(d) => bumpRoundHole(roundId, currentHole.number, "strokes", d)}
          />
          <StepperRow
            label="Putts"
            value={currentHole.putts}
            onSet={(v) => updateRoundHole(roundId, currentHole.number, { putts: v })}
            onBump={(d) => bumpRoundHole(roundId, currentHole.number, "putts", d)}
          />

          {currentHole.par !== 3 && (
            <ToggleRow
              label="Fairway hit"
              value={currentHole.fairwayHit}
              onChange={(v) =>
                updateRoundHole(roundId, currentHole.number, { fairwayHit: v })
              }
            />
          )}
          <ToggleRow
            label="Green in regulation"
            value={currentHole.gir}
            onChange={(v) => updateRoundHole(roundId, currentHole.number, { gir: v })}
          />
        </Card>

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
        <Button onClick={() => finishRound(roundId)} className="flex-1 sm:flex-none">
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

function StepperRow({
  label,
  value,
  onSet,
  onBump,
}: {
  label: string;
  value: number | null;
  onSet: (v: number | null) => void;
  onBump: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-cream-300">{label}</span>
      <div className="flex items-center gap-2">
        {/* +/- go through onBump so the delta is applied to the stored value,
            not to whatever this render happened to show. */}
        <Button
          variant="secondary"
          className="w-12"
          onClick={() => onBump(-1)}
          aria-label={`Decrease ${label}`}
        >
          −
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ""}
          onChange={(e) =>
            onSet(e.target.value === "" ? null : parseInt(e.target.value, 10))
          }
          className="w-16 text-center bg-pine-900 border border-pine-700 rounded-lg min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-kelly-500"
          aria-label={label}
        />
        <Button
          variant="secondary"
          className="w-12"
          onClick={() => onBump(1)}
          aria-label={`Increase ${label}`}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const options: { v: boolean | null; text: string }[] = [
    { v: true, text: "Yes" },
    { v: false, text: "No" },
    { v: null, text: "—" },
  ];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-cream-300">{label}</span>
      <div className="flex gap-1.5">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={String(o.v)}
              onClick={() => onChange(o.v)}
              className={`min-w-14 min-h-11 px-3 rounded-lg text-sm font-medium ${
                active
                  ? o.v === true
                    ? "bg-kelly-600 text-white"
                    : o.v === false
                      ? "bg-red-900/70 text-red-100"
                      : "bg-pine-700 text-cream-200"
                  : "bg-pine-800 text-cream-400"
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>
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
    <table className="w-full text-sm min-w-[560px]">
      <caption className="text-left text-cream-400 mb-2 caption-top">
        {title} <span className="text-cream-600">· par {par}</span>
      </caption>
      <thead>
        <tr className="text-cream-500 text-xs uppercase">
          <th className="text-left font-medium py-1 pr-2">Hole</th>
          <th className="text-left font-medium py-1 pr-2">Par</th>
          <th className="text-left font-medium py-1 pr-2">Strokes</th>
          <th className="text-left font-medium py-1 pr-2">Putts</th>
          <th className="text-left font-medium py-1 pr-2">Fairway</th>
          <th className="text-left font-medium py-1 pr-2">GIR</th>
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
            <td className="py-1.5 pr-2">
              <NumberCell
                value={h.putts}
                onChange={(v) => updateRoundHole(roundId, h.number, { putts: v })}
              />
            </td>
            <td className="py-1.5 pr-2">
              {h.par === 3 ? (
                <span className="text-cream-600">n/a</span>
              ) : (
                <TriToggle
                  value={h.fairwayHit}
                  onChange={(v) => updateRoundHole(roundId, h.number, { fairwayHit: v })}
                />
              )}
            </td>
            <td className="py-1.5 pr-2">
              <TriToggle
                value={h.gir}
                onChange={(v) => updateRoundHole(roundId, h.number, { gir: v })}
              />
            </td>
          </tr>
        ))}
        <tr className="border-t border-pine-700 font-medium">
          <td className="py-1.5 pr-2">Tot</td>
          <td className="py-1.5 pr-2 text-cream-400">{par}</td>
          <td className="py-1.5 pr-2">{strokes || "—"}</td>
          <td className="py-1.5 pr-2">
            {holes.reduce((s, h) => s + (h.putts ?? 0), 0) || "—"}
          </td>
          <td colSpan={2} />
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

function TriToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  function cycle() {
    onChange(value === null ? true : value === true ? false : null);
  }
  const label = value === null ? "—" : value ? "Y" : "N";
  const color =
    value === null
      ? "bg-pine-800 text-cream-500"
      : value
        ? "bg-kelly-600 text-white"
        : "bg-red-900/60 text-red-200";
  return (
    <button type="button" onClick={cycle} className={`w-10 h-9 rounded text-xs font-medium ${color}`}>
      {label}
    </button>
  );
}
