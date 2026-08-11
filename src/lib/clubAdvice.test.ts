import { describe, expect, it } from "vitest";
import { MIN_SHOTS_FOR_CONFIDENCE, adviseClub, clubStats } from "./clubAdvice";
import type { Shot } from "@/types";

let seq = 0;
function shot(club: string, distanceYds: number): Shot {
  seq += 1;
  return {
    id: `s${seq}`,
    date: 1_700_000_000_000 + seq,
    club,
    distanceYds,
    result: null,
    createdAt: 1_700_000_000_000 + seq,
  };
}

describe("clubStats", () => {
  it("returns nothing for no shots", () => {
    expect(clubStats([])).toEqual([]);
  });

  it("averages, ranges, and counts per club", () => {
    const stats = clubStats([shot("7 Iron", 150), shot("7 Iron", 160), shot("7 Iron", 140)]);
    expect(stats).toEqual([
      { club: "7 Iron", avgYds: 150, minYds: 140, maxYds: 160, shots: 3 },
    ]);
  });

  it("sorts longest club first", () => {
    const stats = clubStats([shot("9 Iron", 120), shot("Driver", 240), shot("7 Iron", 150)]);
    expect(stats.map((s) => s.club)).toEqual(["Driver", "7 Iron", "9 Iron"]);
  });

  it("rounds the average to a whole yard", () => {
    // (150 + 151) / 2 = 150.5 -> 151
    expect(clubStats([shot("8 Iron", 150), shot("8 Iron", 151)])[0].avgYds).toBe(151);
  });

  it("ignores non-positive or non-finite distances rather than skewing an average", () => {
    const stats = clubStats([shot("PW", 100), shot("PW", 0), shot("PW", -20), shot("PW", NaN)]);
    expect(stats).toEqual([{ club: "PW", avgYds: 100, minYds: 100, maxYds: 100, shots: 1 }]);
  });

  it("drops a club entirely when every one of its shots is invalid", () => {
    expect(clubStats([shot("SW", 0)])).toEqual([]);
  });
});

describe("adviseClub", () => {
  const bag = [
    ...Array(4).fill(null).map(() => shot("Driver", 240)),
    ...Array(4).fill(null).map(() => shot("7 Iron", 150)),
    ...Array(4).fill(null).map(() => shot("9 Iron", 120)),
  ];

  it("reports no advice when nothing has been logged", () => {
    const advice = adviseClub(150, []);
    expect(advice.primary).toBeNull();
    expect(advice.confidence).toBe("none");
  });

  it("reports no advice for a non-finite distance", () => {
    expect(adviseClub(NaN, bag).confidence).toBe("none");
  });

  it("picks the club whose average is closest to the target", () => {
    expect(adviseClub(148, bag).primary?.club).toBe("7 Iron");
    expect(adviseClub(238, bag).primary?.club).toBe("Driver");
    expect(adviseClub(118, bag).primary?.club).toBe("9 Iron");
  });

  it("picks the nearest average even when it lands short of the target", () => {
    // 130 is 10 from the 9 Iron (120) and 20 from the 7 Iron (150). Choosing
    // "shortest club that covers it" would wrongly force the 7 Iron here.
    expect(adviseClub(130, bag).primary?.club).toBe("9 Iron");
  });

  it("returns the neighbouring clubs around the pick", () => {
    const advice = adviseClub(150, bag);
    expect(advice.primary?.club).toBe("7 Iron");
    expect(advice.longer?.club).toBe("Driver");
    expect(advice.shorter?.club).toBe("9 Iron");
  });

  it("leaves neighbours null at the ends of the bag", () => {
    expect(adviseClub(300, bag).longer).toBeNull();
    expect(adviseClub(10, bag).shorter).toBeNull();
  });

  it("clamps to the longest club when the target is out of range", () => {
    expect(adviseClub(400, bag).primary?.club).toBe("Driver");
  });

  it("flags low confidence below the shot-count threshold", () => {
    const thin = [shot("6 Iron", 165)];
    const advice = adviseClub(165, thin);
    expect(advice.primary?.shots).toBe(1);
    expect(advice.confidence).toBe("low");
  });

  it("flags ok confidence at the threshold", () => {
    const enough = Array(MIN_SHOTS_FOR_CONFIDENCE)
      .fill(null)
      .map(() => shot("6 Iron", 165));
    expect(adviseClub(165, enough).confidence).toBe("ok");
  });

  it("breaks an exact tie toward the better-evidenced club", () => {
    // 5 Iron (170) and 6 Iron (190) are both 10 yards from 180, but the 6 Iron
    // has more shots behind it.
    const shots = [
      ...Array(2).fill(null).map(() => shot("5 Iron", 170)),
      ...Array(6).fill(null).map(() => shot("6 Iron", 190)),
    ];
    expect(adviseClub(180, shots).primary?.club).toBe("6 Iron");
  });
});
