"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { listShots, setCourseHoleGreen } from "@/lib/repo";
import { adviseClub } from "@/lib/clubAdvice";
import { haversineMeters, metersToYards } from "@/lib/geo";
import { useGeoPosition } from "@/lib/useGeoPosition";
import { Button, Card } from "@/components/ui";

/** Beyond this the fix is too vague for a yardage to mean anything. */
const POOR_ACCURACY_M = 25;

/**
 * On-course GPS distance to the centre of the green, plus a club suggestion
 * from the player's own logged yardages.
 *
 * Reads greens from the live Course record rather than the Round: a round
 * snapshots pars at the time it started, but greens can be imported or captured
 * mid-round and should take effect immediately.
 */
export function HoleDistance({
  courseId,
  holeNumber,
}: {
  courseId: string;
  holeNumber: number;
}) {
  const [tracking, setTracking] = useState(false);
  const [saving, setSaving] = useState(false);
  const geo = useGeoPosition(tracking);

  const course = useLiveQuery(
    async () => {
      if (typeof window === "undefined") return undefined;
      return (await requireDb().courses.get(courseId)) ?? null;
    },
    [courseId]
  );

  const shots = useLiveQuery(
    async () => {
      if (typeof window === "undefined") return [];
      return listShots();
    },
    [],
    []
  );

  const green = course?.holes.find((h) => h.number === holeNumber)?.green ?? null;
  const greensSet = course?.holes.filter((h) => h.green).length ?? 0;

  const distanceYds =
    green && geo.coords ? metersToYards(haversineMeters(geo.coords, green)) : null;
  const advice = distanceYds != null ? adviseClub(distanceYds, shots ?? []) : null;

  async function captureGreen() {
    if (!geo.coords) return;
    setSaving(true);
    try {
      await setCourseHoleGreen(courseId, holeNumber, geo.coords);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Distance</h2>
          <p className="text-[11px] text-cream-500">
            {greensSet > 0 ? `${greensSet}/18 greens located` : "No greens located yet"}
          </p>
        </div>
        <Button
          variant={tracking ? "secondary" : "primary"}
          onClick={() => setTracking((t) => !t)}
        >
          {tracking ? "Stop GPS" : "Start GPS"}
        </Button>
      </div>

      {!tracking && (
        <p className="text-sm text-cream-400">
          Start GPS to see how far you are from the centre of the green. It stays off until
          you ask, since a continuous fix drains the battery over a full round.
        </p>
      )}

      {tracking && geo.status === "locating" && (
        <p className="text-sm text-cream-400">Getting a GPS fix…</p>
      )}

      {tracking && geo.status === "error" && (
        <p className="text-sm text-red-400">{geo.message}</p>
      )}

      {tracking && geo.status === "active" && (
        <>
          {distanceYds != null ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tabular-nums">
                  {Math.round(distanceYds)}
                </span>
                <span className="text-cream-400 text-sm">yds to green centre</span>
              </div>
              {advice?.primary ? (
                <div className="mt-2">
                  <div className="text-sm">
                    <span className="text-kelly-400 font-semibold">{advice.primary.club}</span>
                    <span className="text-cream-400">
                      {" "}
                      — your average {advice.primary.avgYds} yds
                    </span>
                  </div>
                  <div className="text-[11px] text-cream-500 mt-0.5">
                    {advice.confidence === "low"
                      ? `Only ${advice.primary.shots} shot${advice.primary.shots === 1 ? "" : "s"} logged for this club — treat it as a guess.`
                      : `From ${advice.primary.shots} logged shots.`}
                    {advice.longer && ` Up: ${advice.longer.club}.`}
                    {advice.shorter && ` Down: ${advice.shorter.club}.`}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-cream-500 mt-2">
                  Log some shots on the Yardages page to get a club suggestion here.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-amber-400/90">
                Hole {holeNumber} has no green location yet. Stand on the green and save it —
                it&apos;s stored with the course, so this is a one-time step per hole.
              </p>
              <Button variant="secondary" onClick={captureGreen} disabled={saving}>
                {saving ? "Saving…" : "Set green at my position"}
              </Button>
            </div>
          )}

          <p className="text-[11px] text-cream-600">
            {geo.accuracyM != null && (
              <>
                GPS accurate to about {Math.round(geo.accuracyM)} m
                {geo.accuracyM > POOR_ACCURACY_M && " — weak fix, treat the yardage loosely"}
                {". "}
              </>
            )}
            Measured to the centre of the green, not the pin, which moves daily.
          </p>
        </>
      )}
    </Card>
  );
}
