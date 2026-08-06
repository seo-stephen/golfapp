// WHS (World Handicap System) handicap calculation.
//
// Simplifications vs. the full Rules of Handicapping: no net-double-bogey
// per-hole cap, no Playing Conditions Calculation, no soft/hard cap on upward
// movement, and no 9-hole score combining. The lowest-N table and the absence
// of any multiplier do match the real rules — see MIN_ROUNDS note below.
//
// Deliberately NOT applied: the old "× 0.96 bonus for excellence" factor. That
// belonged to the pre-2020 USGA system and was removed by WHS; including it
// would report every index about 4% low.

/** WHS requires 54 holes (three 18-hole rounds) before an index is issued. */
export const MIN_ROUNDS_FOR_INDEX = 3;

/** Rules of Handicapping caps a Handicap Index at 54.0. */
export const MAX_HANDICAP_INDEX = 54.0;

export function computeDifferential(
  totalStrokes: number,
  courseRating: number,
  slopeRating: number
): number {
  const differential = (113 / slopeRating) * (totalStrokes - courseRating);
  return Math.round(differential * 10) / 10;
}

// The WHS "fewer than 20 scores" table: how many of the lowest differentials to
// average, and the adjustment applied to that average.
function tableFor(n: number): { take: number; adjustment: number } {
  if (n >= 20) return { take: 8, adjustment: 0 };
  if (n === 19) return { take: 7, adjustment: 0 };
  if (n >= 17) return { take: 6, adjustment: 0 }; // 17-18
  if (n >= 15) return { take: 5, adjustment: 0 }; // 15-16
  if (n >= 12) return { take: 4, adjustment: 0 }; // 12-14
  if (n >= 9) return { take: 3, adjustment: 0 }; //  9-11
  if (n >= 7) return { take: 2, adjustment: 0 }; //  7-8
  if (n === 6) return { take: 2, adjustment: -1.0 };
  if (n === 5) return { take: 1, adjustment: 0 };
  if (n === 4) return { take: 1, adjustment: -1.0 };
  return { take: 1, adjustment: -2.0 }; // n === 3
}

/**
 * @param differentialsChronological oldest first.
 * @returns the Handicap Index, or null when there are fewer than
 *   MIN_ROUNDS_FOR_INDEX rounds — WHS issues no index before then.
 */
export function computeHandicapIndex(
  differentialsChronological: number[]
): number | null {
  if (differentialsChronological.length < MIN_ROUNDS_FOR_INDEX) return null;

  const recent = differentialsChronological.slice(-20);
  const { take, adjustment } = tableFor(recent.length);

  const lowest = [...recent].sort((a, b) => a - b).slice(0, take);
  const avg = lowest.reduce((sum, d) => sum + d, 0) / lowest.length;
  const index = avg + adjustment;
  const rounded = Math.round(index * 10) / 10;
  return Math.min(rounded, MAX_HANDICAP_INDEX);
}
