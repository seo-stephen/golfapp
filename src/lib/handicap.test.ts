import { describe, expect, it } from "vitest";
import {
  MAX_HANDICAP_INDEX,
  MIN_ROUNDS_FOR_INDEX,
  computeDifferential,
  computeHandicapIndex,
} from "./handicap";

describe("computeDifferential", () => {
  it("applies (113 / slope) * (score - rating), rounded to one decimal", () => {
    // (113/118) * (81 - 69.5) = 0.95762… * 11.5 = 11.012…
    expect(computeDifferential(81, 69.5, 118)).toBe(11);
    // (113/118) * (76 - 69.5) = 0.95762… * 6.5 = 6.224…
    expect(computeDifferential(76, 69.5, 118)).toBe(6.2);
    // (113/118) * (75 - 69.5) = 0.95762… * 5.5 = 5.267…
    expect(computeDifferential(75, 69.5, 118)).toBe(5.3);
  });

  it("is 0 when the score exactly equals the course rating", () => {
    expect(computeDifferential(72, 72, 113)).toBe(0);
  });

  it("goes negative when the player beats the course rating", () => {
    // (113/113) * (68 - 72) = -4
    expect(computeDifferential(68, 72, 113)).toBe(-4);
  });

  it("scales with slope: a harder course yields a lower differential", () => {
    const easy = computeDifferential(90, 70, 100);
    const hard = computeDifferential(90, 70, 150);
    expect(hard).toBeLessThan(easy);
  });
});

describe("computeHandicapIndex", () => {
  it("returns null below the WHS 54-hole (3 round) minimum", () => {
    expect(computeHandicapIndex([])).toBeNull();
    expect(computeHandicapIndex([10])).toBeNull();
    expect(computeHandicapIndex([10, 12])).toBeNull();
    expect(computeHandicapIndex(Array(MIN_ROUNDS_FOR_INDEX - 1).fill(10))).toBeNull();
  });

  it("does NOT apply the retired 0.96 bonus-for-excellence multiplier", () => {
    // 20 identical differentials of 10 -> average of lowest 8 is exactly 10.0.
    // The pre-2020 USGA system would have returned 9.6.
    expect(computeHandicapIndex(Array(20).fill(10))).toBe(10);
  });

  it("caps the index at 54.0", () => {
    expect(computeHandicapIndex(Array(20).fill(90))).toBe(MAX_HANDICAP_INDEX);
  });

  // The WHS "fewer than 20 scores" table. Each case uses a record where the
  // lowest values are 1,2,3,… so the expected average is easy to state exactly.
  const table: {
    n: number;
    take: number;
    adjustment: number;
  }[] = [
    { n: 3, take: 1, adjustment: -2.0 },
    { n: 4, take: 1, adjustment: -1.0 },
    { n: 5, take: 1, adjustment: 0 },
    { n: 6, take: 2, adjustment: -1.0 },
    { n: 7, take: 2, adjustment: 0 },
    { n: 8, take: 2, adjustment: 0 },
    { n: 9, take: 3, adjustment: 0 },
    { n: 10, take: 3, adjustment: 0 },
    { n: 11, take: 3, adjustment: 0 },
    { n: 12, take: 4, adjustment: 0 },
    { n: 13, take: 4, adjustment: 0 },
    { n: 14, take: 4, adjustment: 0 },
    { n: 15, take: 5, adjustment: 0 },
    { n: 16, take: 5, adjustment: 0 },
    { n: 17, take: 6, adjustment: 0 },
    { n: 18, take: 6, adjustment: 0 },
    { n: 19, take: 7, adjustment: 0 },
    { n: 20, take: 8, adjustment: 0 },
  ];

  it.each(table)(
    "with $n differentials averages the lowest $take with adjustment $adjustment",
    ({ n, take, adjustment }) => {
      // Differentials 1..n, so the lowest `take` are 1..take.
      const diffs = Array.from({ length: n }, (_, i) => i + 1);
      const expectedAvg =
        Array.from({ length: take }, (_, i) => i + 1).reduce((a, b) => a + b, 0) / take;
      const expected = Math.round((expectedAvg + adjustment) * 10) / 10;
      expect(computeHandicapIndex(diffs)).toBe(expected);
    }
  );

  it("uses only the most recent 20 differentials", () => {
    // Twenty 10s preceded by a batch of very low scores that must be ignored.
    const stale = Array(15).fill(-5);
    const recent = Array(20).fill(10);
    expect(computeHandicapIndex([...stale, ...recent])).toBe(10);
  });

  it("takes the LOWEST differentials, not the most recent ones", () => {
    // 20 rounds: one great round (2) buried among 19 poor ones (30).
    // Lowest 8 = [2, 30 x7] -> (2 + 210) / 8 = 26.5
    const diffs = [2, ...Array(19).fill(30)];
    expect(computeHandicapIndex(diffs)).toBe(26.5);
  });

  it("ignores order for the same multiset of differentials", () => {
    const a = [5, 12, 8, 20, 3, 15, 9, 11, 30, 7];
    const b = [...a].reverse();
    expect(computeHandicapIndex(a)).toBe(computeHandicapIndex(b));
  });

  it("rounds to the nearest tenth", () => {
    // 9 differentials -> lowest 3 averaged, no adjustment.
    // lowest 3 of [1, 2, 2.1, ...] = (1 + 2 + 2.1)/3 = 1.7(repeating) -> 1.7
    const diffs = [1, 2, 2.1, 40, 40, 40, 40, 40, 40];
    expect(computeHandicapIndex(diffs)).toBe(1.7);
  });

  it("supports a plus handicap (negative index) for a strong player", () => {
    // Lowest 8 all -2 -> index -2.0, i.e. a "plus 2" player.
    expect(computeHandicapIndex(Array(20).fill(-2))).toBe(-2);
  });

  it("matches a worked three-round example end to end", () => {
    // Sample Municipal, White tee: rating 69.5, slope 118.
    const diffs = [
      computeDifferential(81, 69.5, 118), // 11.0
      computeDifferential(76, 69.5, 118), // 6.2
      computeDifferential(75, 69.5, 118), // 5.3
    ];
    expect(diffs).toEqual([11, 6.2, 5.3]);
    // n=3 -> lowest 1 (5.3) with -2.0 adjustment = 3.3
    expect(computeHandicapIndex(diffs)).toBe(3.3);
  });
});
