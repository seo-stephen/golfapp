import { describe, expect, it } from "vitest";
import {
  GOLF_SCORE_THRESHOLDS,
  findNextGoodDay,
  rankGolfDays,
  scoreGolfDay,
  type DailyForecast,
} from "./weather";

function day(overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    date: "2026-08-12",
    weatherCode: 0,
    tempMaxC: 22,
    tempMinC: 16,
    precipitationProbabilityMax: 0,
    windSpeedMaxKmh: 8,
    ...overrides,
  };
}

describe("scoreGolfDay", () => {
  it("scores a clear, calm, mild day at (or near) 100", () => {
    expect(scoreGolfDay(day())).toEqual({ score: 100, label: "great" });
  });

  it("penalizes rain chance directly, at 0.6 points per percent", () => {
    // 100 - 50*0.6 = 70
    expect(scoreGolfDay(day({ precipitationProbabilityMax: 50 })).score).toBe(70);
  });

  it("treats a missing precipitation probability as 0, not a penalty", () => {
    expect(scoreGolfDay(day({ precipitationProbabilityMax: null })).score).toBe(100);
  });

  it("only penalizes wind past 24 km/h", () => {
    expect(scoreGolfDay(day({ windSpeedMaxKmh: 24 })).score).toBe(100);
    // 100 - (40-24)*1.25 = 80
    expect(scoreGolfDay(day({ windSpeedMaxKmh: 40 })).score).toBe(80);
  });

  it("only penalizes temperature outside a 10-30°C comfort band", () => {
    expect(scoreGolfDay(day({ tempMaxC: 10 })).score).toBe(100);
    expect(scoreGolfDay(day({ tempMaxC: 30 })).score).toBe(100);
    // 100 - (10-6)*3.5 = 86
    expect(scoreGolfDay(day({ tempMaxC: 6 })).score).toBe(86);
    // 100 - (34-30)*3.5 = 86
    expect(scoreGolfDay(day({ tempMaxC: 34 })).score).toBe(86);
  });

  it("clamps at 0 rather than going negative", () => {
    expect(
      scoreGolfDay(day({ precipitationProbabilityMax: 100, windSpeedMaxKmh: 100, tempMaxC: -20 }))
        .score
    ).toBe(0);
  });

  it("forces a 0/poor score for thunderstorms and snow regardless of other factors", () => {
    // Otherwise-perfect day, but a thunderstorm code.
    expect(scoreGolfDay(day({ weatherCode: 95 }))).toEqual({ score: 0, label: "poor" });
    expect(scoreGolfDay(day({ weatherCode: 75 })).score).toBe(0);
  });

  it("labels according to the exported thresholds", () => {
    expect(scoreGolfDay(day({ precipitationProbabilityMax: (100 - GOLF_SCORE_THRESHOLDS.great) / 0.6 + 1 })).label).not.toBe("great");
    expect(scoreGolfDay(day({ precipitationProbabilityMax: 0 })).label).toBe("great");
  });
});

describe("rankGolfDays", () => {
  it("scores every day in order, unfiltered", () => {
    const days = [day({ date: "d1" }), day({ date: "d2", weatherCode: 95 })];
    const ranked = rankGolfDays(days);
    expect(ranked.map((r) => r.forecast.date)).toEqual(["d1", "d2"]);
    expect(ranked[1].golf.label).toBe("poor");
  });
});

describe("findNextGoodDay", () => {
  it("returns null for an empty forecast", () => {
    expect(findNextGoodDay([])).toBeNull();
  });

  it("picks the first day that clears the 'good' bar, not just the best one", () => {
    const days = [
      day({ date: "d1", precipitationProbabilityMax: 90 }), // poor
      day({ date: "d2", precipitationProbabilityMax: 0 }), // great, but not the highest-scoring day below
      day({ date: "d3", weatherCode: 0, precipitationProbabilityMax: 0, windSpeedMaxKmh: 0 }),
    ];
    const result = findNextGoodDay(days);
    expect(result?.meetsThreshold).toBe(true);
    expect(result?.day.forecast.date).toBe("d2");
  });

  it("falls back to the best available day when none clear the bar", () => {
    const days = [
      day({ date: "bad", precipitationProbabilityMax: 100 }),
      day({ date: "less-bad", precipitationProbabilityMax: 80 }),
    ];
    const result = findNextGoodDay(days);
    expect(result?.meetsThreshold).toBe(false);
    expect(result?.day.forecast.date).toBe("less-bad");
  });
});
