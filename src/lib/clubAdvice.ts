import type { Shot } from "@/types";

export interface ClubStat {
  club: string;
  avgYds: number;
  minYds: number;
  maxYds: number;
  shots: number;
}

/**
 * Per-club distance rollup, longest club first — the order a printed yardage
 * book reads in. Shared by the yardage book and the on-course club suggestion
 * so both are driven by exactly the same averages.
 */
export function clubStats(shots: Shot[]): ClubStat[] {
  const byClub = new Map<string, number[]>();
  for (const s of shots) {
    if (!Number.isFinite(s.distanceYds) || s.distanceYds <= 0) continue;
    byClub.set(s.club, [...(byClub.get(s.club) ?? []), s.distanceYds]);
  }

  return [...byClub.entries()]
    .map(([club, distances]) => ({
      club,
      shots: distances.length,
      avgYds: Math.round(distances.reduce((a, b) => a + b, 0) / distances.length),
      minYds: Math.min(...distances),
      maxYds: Math.max(...distances),
    }))
    .sort((a, b) => b.avgYds - a.avgYds);
}

/** How far to trust a suggestion, driven purely by how many shots back it. */
export type ClubConfidence = "none" | "low" | "ok";

export const MIN_SHOTS_FOR_CONFIDENCE = 3;

export interface ClubAdvice {
  primary: ClubStat | null;
  /** Neighbouring clubs, so wind or lie can override the pick. */
  shorter: ClubStat | null;
  longer: ClubStat | null;
  confidence: ClubConfidence;
}

/**
 * Suggests the club whose average carry is nearest the target.
 *
 * Deliberately *not* "the shortest club that covers the distance": logged
 * averages already include mishits, so that rule systematically over-clubs.
 * Neighbours come back too — this is a starting point for a judgement call, not
 * an instruction.
 */
export function adviseClub(distanceYds: number, shots: Shot[]): ClubAdvice {
  const stats = clubStats(shots);
  if (stats.length === 0 || !Number.isFinite(distanceYds)) {
    return { primary: null, shorter: null, longer: null, confidence: "none" };
  }

  let bestIdx = 0;
  for (let i = 1; i < stats.length; i++) {
    const gap = Math.abs(stats[i].avgYds - distanceYds);
    const bestGap = Math.abs(stats[bestIdx].avgYds - distanceYds);
    // On a tie, prefer the club with more logged shots — the better-evidenced
    // of two equally-close averages.
    if (gap < bestGap || (gap === bestGap && stats[i].shots > stats[bestIdx].shots)) {
      bestIdx = i;
    }
  }

  const primary = stats[bestIdx];
  return {
    primary,
    // stats runs longest-first, so the next index along is the shorter club.
    longer: stats[bestIdx - 1] ?? null,
    shorter: stats[bestIdx + 1] ?? null,
    confidence: primary.shots >= MIN_SHOTS_FOR_CONFIDENCE ? "ok" : "low",
  };
}
