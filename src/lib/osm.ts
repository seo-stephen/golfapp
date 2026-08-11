import { haversineMeters, nearestTo, ringCentroid } from "@/lib/geo";
import type { LatLon } from "@/types";

/**
 * Turning OpenStreetMap golf data into per-hole green positions.
 *
 * Why this shape: OSM has almost no `golf=pin` nodes (a Toronto-wide query
 * returns zero), but it does have `golf=green` areas and `golf=hole` ways. A
 * hole way carries the hole number in `ref` and runs between tee and green, so
 * matching its green-side end to the nearest mapped green recovers both the
 * hole numbering and a usable green centre.
 */

/** The subset of an Overpass element we rely on (queried with `out tags geom`). */
export interface OverpassElement {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: ({ lat?: number; lon?: number } | null)[];
}

export interface ImportedHole {
  number: number;
  par: number | null;
  green: LatLon;
  /** Straight tee-to-green length, useful for sanity-checking an import. */
  lengthM: number;
  /** How far the hole way's end sat from the matched green centre. */
  matchM: number;
}

/**
 * A hole's green end has to land essentially on a mapped green.
 *
 * 20 m, not more: measured against a real course every correct match landed
 * within 0-7 m, while a looser 30 m let hole 17 — whose own green isn't mapped —
 * latch onto hole 16's green 28 m away and report a yardage ~30 yards wrong.
 * A wrong distance is worse than no distance, so this errs toward rejecting.
 */
export const MAX_GREEN_MATCH_M = 20;

export function extractHoleGreens(elements: OverpassElement[]): ImportedHole[] {
  const greenCentres: LatLon[] = [];
  const holeWays: { number: number; par: number | null; points: LatLon[] }[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const points = cleanGeometry(el.geometry);

    if (tags.golf === "green") {
      const centre = ringCentroid(points);
      if (centre) greenCentres.push(centre);
      continue;
    }

    if (tags.golf === "hole") {
      const number = parseIntOrNull(tags.ref);
      // A hole way needs two ends to have a tee and a green.
      if (number != null && number >= 1 && number <= 18 && points.length >= 2) {
        holeWays.push({ number, par: parseIntOrNull(tags.par), points });
      }
    }
  }

  if (greenCentres.length === 0) return [];

  const byHole = new Map<number, Candidate>();
  for (const hole of holeWays) {
    const matched = matchHole(hole, greenCentres);
    if (!matched) continue;
    // One query radius can cover two adjacent courses, which collide on hole
    // numbers. Keep whichever candidate sat closer to a green.
    const existing = byHole.get(matched.hole.number);
    if (!existing || matched.hole.matchM < existing.hole.matchM) {
      byHole.set(matched.hole.number, matched);
    }
  }

  return resolveGreenConflicts([...byHole.values()]);
}

/** A matched hole plus which green it claimed, so claims can be made exclusive. */
interface Candidate {
  hole: ImportedHole;
  greenIndex: number;
}

/**
 * Each green belongs to exactly one hole.
 *
 * Without this, a hole whose own green is unmapped will quietly adopt a
 * neighbour's — observed on a real course, where holes 16 and 17 both resolved
 * to the same green. The tighter match keeps it; the loser is dropped so that
 * hole falls back to being set by hand, which is honest rather than wrong.
 */
function resolveGreenConflicts(candidates: Candidate[]): ImportedHole[] {
  const winnerByGreen = new Map<number, Candidate>();
  for (const candidate of candidates) {
    const held = winnerByGreen.get(candidate.greenIndex);
    if (!held || candidate.hole.matchM < held.hole.matchM) {
      winnerByGreen.set(candidate.greenIndex, candidate);
    }
  }

  return [...winnerByGreen.values()]
    .map((c) => c.hole)
    .sort((a, b) => a.number - b.number);
}

/**
 * Both ends are tested rather than assuming the way runs tee-to-green. The
 * tagging convention says it should, but this is crowd-sourced data — and since
 * only one end can sit on a green, testing both repairs a reversed way for free.
 */
function matchHole(
  hole: { number: number; par: number | null; points: LatLon[] },
  greenCentres: LatLon[]
): Candidate | null {
  const first = hole.points[0];
  const last = hole.points[hole.points.length - 1];
  const ends = [
    { greenEnd: last, teeEnd: first },
    { greenEnd: first, teeEnd: last },
  ];

  let best: Candidate | null = null;
  for (const { greenEnd, teeEnd } of ends) {
    const nearest = nearestTo(greenEnd, greenCentres);
    if (!nearest || nearest.distanceM > MAX_GREEN_MATCH_M) continue;
    if (best && best.hole.matchM <= nearest.distanceM) continue;
    best = {
      greenIndex: nearest.index,
      hole: {
        number: hole.number,
        par: hole.par,
        green: nearest.point,
        lengthM: haversineMeters(teeEnd, nearest.point),
        matchM: nearest.distanceM,
      },
    };
  }
  return best;
}

function cleanGeometry(geometry: OverpassElement["geometry"]): LatLon[] {
  if (!Array.isArray(geometry)) return [];
  // Overpass emits nulls for nodes clipped outside the query area.
  return geometry.flatMap((p) =>
    p && Number.isFinite(p.lat) && Number.isFinite(p.lon)
      ? [{ lat: p.lat as number, lon: p.lon as number }]
      : []
  );
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value) return null;
  // `ref` is occasionally "1;10" on a shared hole; the leading number is right.
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
