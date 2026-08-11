import { describe, expect, it } from "vitest";
import {
  bearingDeg,
  haversineMeters,
  metersToYards,
  nearestTo,
  ringCentroid,
  yardsToMeters,
} from "./geo";

// One degree of latitude on a sphere of radius 6371008.8 m:
// 6371008.8 * pi/180 = 111194.93 m
const ONE_DEGREE_M = 111194.93;

describe("haversineMeters", () => {
  it("is 0 for the same point", () => {
    expect(haversineMeters({ lat: 43.7, lon: -79.4 }, { lat: 43.7, lon: -79.4 })).toBe(0);
  });

  it("matches one degree of latitude", () => {
    expect(haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(ONE_DEGREE_M, 0);
  });

  it("matches one degree of longitude at the equator", () => {
    expect(haversineMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(ONE_DEGREE_M, 0);
  });

  it("shrinks a degree of longitude with latitude (cos 60 = 0.5)", () => {
    const atEquator = haversineMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    const at60 = haversineMeters({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
    expect(at60 / atEquator).toBeCloseTo(0.5, 2);
  });

  it("is symmetric", () => {
    const a = { lat: 43.75, lon: -79.35 };
    const b = { lat: 43.7476, lon: -79.3563 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 9);
  });

  it("measures a golf-hole scale distance sensibly", () => {
    // Roughly a 350 m par 4 laid out due north.
    const tee = { lat: 43.75, lon: -79.35 };
    const green = { lat: 43.75 + 350 / ONE_DEGREE_M, lon: -79.35 };
    expect(haversineMeters(tee, green)).toBeCloseTo(350, 0);
  });

  it("handles crossing the antimeridian without blowing up", () => {
    // 0.002 degrees of longitude apart, straddling 180.
    const d = haversineMeters({ lat: 0, lon: 179.999 }, { lat: 0, lon: -179.999 });
    expect(d).toBeCloseTo(ONE_DEGREE_M * 0.002, 0);
  });
});

describe("metersToYards / yardsToMeters", () => {
  it("converts 100 m to about 109.4 yards", () => {
    expect(metersToYards(100)).toBeCloseTo(109.36, 2);
  });

  it("round-trips", () => {
    expect(yardsToMeters(metersToYards(150))).toBeCloseTo(150, 9);
  });
});

describe("bearingDeg", () => {
  it("reads 0 for due north and 90 for due east", () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 6);
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 6);
  });

  it("reads 180 for due south and 270 for due west", () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: -1, lon: 0 })).toBeCloseTo(180, 6);
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: -1 })).toBeCloseTo(270, 6);
  });

  it("always returns 0-360, never negative", () => {
    const b = bearingDeg({ lat: 43.7, lon: -79.4 }, { lat: 43.6, lon: -79.5 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("ringCentroid", () => {
  it("returns null for no points", () => {
    expect(ringCentroid([])).toBeNull();
  });

  it("returns the point itself for a single vertex", () => {
    expect(ringCentroid([{ lat: 1, lon: 2 }])).toEqual({ lat: 1, lon: 2 });
  });

  it("averages a simple square", () => {
    const c = ringCentroid([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 2 },
      { lat: 2, lon: 2 },
      { lat: 2, lon: 0 },
    ]);
    expect(c).toEqual({ lat: 1, lon: 1 });
  });

  it("drops OSM's repeated closing vertex so it isn't double-weighted", () => {
    const open = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 2 },
      { lat: 2, lon: 2 },
      { lat: 2, lon: 0 },
    ];
    // Same ring, explicitly closed the way Overpass emits it.
    const closed = [...open, { lat: 0, lon: 0 }];
    expect(ringCentroid(closed)).toEqual(ringCentroid(open));
  });
});

describe("nearestTo", () => {
  it("returns null when there are no candidates", () => {
    expect(nearestTo({ lat: 0, lon: 0 }, [])).toBeNull();
  });

  it("picks the closest candidate and reports its distance and index", () => {
    const from = { lat: 0, lon: 0 };
    const near = { lat: 0.001, lon: 0 };
    const far = { lat: 0.5, lon: 0 };
    const result = nearestTo(from, [far, near]);
    expect(result?.point).toEqual(near);
    expect(result?.index).toBe(1);
    expect(result?.distanceM).toBeCloseTo(ONE_DEGREE_M * 0.001, 0);
  });

  it("distinguishes duplicate coordinates by index", () => {
    const dup = { lat: 1, lon: 1 };
    expect(nearestTo({ lat: 1, lon: 1 }, [dup, dup])?.index).toBe(0);
  });
});
