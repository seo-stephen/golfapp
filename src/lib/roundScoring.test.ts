import { describe, expect, it } from "vitest";
import { isScoreComplete, totalStrokesFor } from "./repo";
import { computeDifferential } from "./handicap";
import type { HoleScore, Round } from "@/types";

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];

function holes(strokes: (number | null)[]): HoleScore[] {
  return PARS.map((par, i) => ({
    number: i + 1,
    par,
    strokes: strokes[i] ?? null,
    putts: null,
    fairwayHit: null,
    gir: null,
    penalties: null,
  }));
}

function round(strokes: (number | null)[]): Round {
  return {
    id: "r1",
    courseId: "c1",
    courseName: "Sample Municipal Golf Course",
    teeName: "White",
    courseRating: 69.5,
    slopeRating: 118,
    date: 0,
    holeScores: holes(strokes),
    completed: false,
    differential: null,
    createdAt: 0,
  };
}

describe("isScoreComplete", () => {
  it("is true only when all 18 holes have a stroke count", () => {
    expect(isScoreComplete(round(Array(18).fill(4)))).toBe(true);
  });

  it("is false when any hole is missing", () => {
    const partial = Array(18).fill(4);
    partial[7] = null;
    expect(isScoreComplete(round(partial))).toBe(false);
  });

  it("is false for a front-nine-only round", () => {
    const front = [...Array(9).fill(4), ...Array(9).fill(null)];
    expect(isScoreComplete(round(front))).toBe(false);
  });

  it("is false when a hole is recorded as 0 strokes", () => {
    const zeroed = Array(18).fill(4);
    zeroed[3] = 0;
    expect(isScoreComplete(round(zeroed))).toBe(false);
  });

  it("is false for an empty scorecard", () => {
    expect(isScoreComplete(round(Array(18).fill(null)))).toBe(false);
  });
});

describe("totalStrokesFor", () => {
  it("sums entered strokes", () => {
    expect(totalStrokesFor(round(Array(18).fill(4)))).toBe(72);
  });

  it("treats missing holes as contributing nothing", () => {
    const front = [...Array(9).fill(5), ...Array(9).fill(null)];
    expect(totalStrokesFor(round(front))).toBe(45);
  });
});

describe("partial rounds must not produce a handicap differential", () => {
  it("would yield an absurdly negative differential if summed naively", () => {
    // This is the bug being guarded against: a front-nine-only round sums to 45,
    // and treating that as an 18-hole score gives a differential of about -23,
    // which would become the player's "best" round and wreck their index.
    const front = [...Array(9).fill(5), ...Array(9).fill(null)];
    const r = round(front);
    const naive = computeDifferential(
      totalStrokesFor(r),
      r.courseRating,
      r.slopeRating
    );
    expect(naive).toBeLessThan(-20);
    // Which is exactly why the round is not score-complete and gets no
    // differential recorded.
    expect(isScoreComplete(r)).toBe(false);
  });

  it("a complete round yields a sane differential", () => {
    const r = round([5, 4, 3, 6, 5, 4, 4, 5, 5, 4, 3, 5, 6, 4, 5, 3, 4, 6]);
    expect(isScoreComplete(r)).toBe(true);
    expect(totalStrokesFor(r)).toBe(81);
    expect(
      computeDifferential(totalStrokesFor(r), r.courseRating, r.slopeRating)
    ).toBe(11);
  });
});
