import { describe, expect, it } from "vitest";
import { MAX_GREEN_MATCH_M, extractHoleGreens, type OverpassElement } from "./osm";

// A degree of latitude is ~111195 m, so this converts metres to a latitude
// offset — handy for placing test features a known distance apart.
const M = 1 / 111194.93;

const BASE_LAT = 43.75;
const BASE_LON = -79.35;

/** A tiny square green centred on (lat, lon), closed the way Overpass emits it. */
function green(lat: number, lon: number): OverpassElement {
  const d = 10 * M; // ~10 m half-width
  return {
    type: "way",
    tags: { golf: "green" },
    geometry: [
      { lat: lat - d, lon: lon - d },
      { lat: lat - d, lon: lon + d },
      { lat: lat + d, lon: lon + d },
      { lat: lat + d, lon: lon - d },
      { lat: lat - d, lon: lon - d },
    ],
  };
}

/** A hole way from `teeLat` to `greenLat` at a fixed longitude. */
function hole(
  ref: string,
  teeLat: number,
  greenLat: number,
  extra: Record<string, string> = {}
): OverpassElement {
  return {
    type: "way",
    tags: { golf: "hole", ref, ...extra },
    geometry: [
      { lat: teeLat, lon: BASE_LON },
      { lat: greenLat, lon: BASE_LON },
    ],
  };
}

describe("extractHoleGreens", () => {
  it("returns nothing when there are no greens to match against", () => {
    expect(extractHoleGreens([hole("1", BASE_LAT, BASE_LAT + 300 * M)])).toEqual([]);
  });

  it("returns nothing for greens with no hole ways", () => {
    expect(extractHoleGreens([green(BASE_LAT, BASE_LON)])).toEqual([]);
  });

  it("matches a hole to its green and measures tee-to-green length", () => {
    const greenLat = BASE_LAT + 300 * M;
    const result = extractHoleGreens([
      hole("1", BASE_LAT, greenLat, { par: "4" }),
      green(greenLat, BASE_LON),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
    expect(result[0].par).toBe(4);
    expect(result[0].lengthM).toBeCloseTo(300, 0);
    expect(result[0].matchM).toBeLessThan(1);
    expect(result[0].green.lat).toBeCloseTo(greenLat, 6);
  });

  it("repairs a way drawn green-to-tee instead of tee-to-green", () => {
    const greenLat = BASE_LAT + 300 * M;
    // Reversed: the FIRST point is on the green.
    const reversed: OverpassElement = {
      type: "way",
      tags: { golf: "hole", ref: "7", par: "3" },
      geometry: [
        { lat: greenLat, lon: BASE_LON },
        { lat: BASE_LAT, lon: BASE_LON },
      ],
    };

    const result = extractHoleGreens([reversed, green(greenLat, BASE_LON)]);
    expect(result).toHaveLength(1);
    // Still finds the green end, and still measures the full hole.
    expect(result[0].green.lat).toBeCloseTo(greenLat, 6);
    expect(result[0].lengthM).toBeCloseTo(300, 0);
  });

  it("rejects a green further than the match threshold", () => {
    const greenLat = BASE_LAT + 300 * M;
    // Green sits well beyond MAX_GREEN_MATCH_M from either end of the way.
    const strayLat = greenLat + (MAX_GREEN_MATCH_M + 40) * M;
    expect(extractHoleGreens([hole("1", BASE_LAT, greenLat), green(strayLat, BASE_LON)])).toEqual(
      []
    );
  });

  it("keeps the tighter match when two courses collide on a hole number", () => {
    const greenLat = BASE_LAT + 300 * M;
    // Two "hole 1"s: one ending exactly on the green, one 20 m off it.
    const exact = hole("1", BASE_LAT, greenLat);
    const sloppy = hole("1", BASE_LAT, greenLat + 20 * M);

    const result = extractHoleGreens([sloppy, exact, green(greenLat, BASE_LON)]);
    expect(result).toHaveLength(1);
    expect(result[0].matchM).toBeLessThan(1);
  });

  // Regression: on a real Toronto course, hole 17's green is unmapped, so its
  // way's end matched hole 16's green 28 m away and reported a yardage ~30
  // yards wrong. Each green must belong to exactly one hole.
  it("refuses to let two holes share one green, keeping the tighter match", () => {
    const sharedLat = BASE_LAT + 300 * M;
    const onGreen = hole("16", BASE_LAT, sharedLat);
    // Hole 17 ends 15 m short of the same green — inside the threshold, but
    // that green is already hole 16's.
    const adopting = hole("17", BASE_LAT, sharedLat - 15 * M);

    const result = extractHoleGreens([onGreen, adopting, green(sharedLat, BASE_LON)]);
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(16);
  });

  it("still gives each hole its own green when both are mapped", () => {
    const green16 = BASE_LAT + 300 * M;
    const green17 = BASE_LAT + 900 * M;
    const result = extractHoleGreens([
      hole("16", BASE_LAT, green16),
      hole("17", green16 + 100 * M, green17),
      green(green16, BASE_LON),
      green(green17, BASE_LON),
    ]);
    expect(result.map((h) => h.number)).toEqual([16, 17]);
    expect(result[0].green.lat).toBeCloseTo(green16, 6);
    expect(result[1].green.lat).toBeCloseTo(green17, 6);
  });

  it("ignores hole numbers outside 1-18", () => {
    const greenLat = BASE_LAT + 300 * M;
    const g = green(greenLat, BASE_LON);
    expect(extractHoleGreens([hole("0", BASE_LAT, greenLat), g])).toEqual([]);
    expect(extractHoleGreens([hole("19", BASE_LAT, greenLat), g])).toEqual([]);
  });

  it("ignores a hole way with no ref, since it can't be assigned to a hole", () => {
    const greenLat = BASE_LAT + 300 * M;
    const unref: OverpassElement = {
      type: "way",
      tags: { golf: "hole" },
      geometry: [
        { lat: BASE_LAT, lon: BASE_LON },
        { lat: greenLat, lon: BASE_LON },
      ],
    };
    expect(extractHoleGreens([unref, green(greenLat, BASE_LON)])).toEqual([]);
  });

  it("reads a leading number out of a shared ref like \"1;10\"", () => {
    const greenLat = BASE_LAT + 300 * M;
    const result = extractHoleGreens([
      hole("1;10", BASE_LAT, greenLat),
      green(greenLat, BASE_LON),
    ]);
    expect(result[0]?.number).toBe(1);
  });

  it("reports a null par when the tag is missing rather than inventing 4", () => {
    const greenLat = BASE_LAT + 300 * M;
    const result = extractHoleGreens([hole("2", BASE_LAT, greenLat), green(greenLat, BASE_LON)]);
    expect(result[0].par).toBeNull();
  });

  it("survives geometry containing nulls from a clipped query", () => {
    const greenLat = BASE_LAT + 300 * M;
    const clipped: OverpassElement = {
      type: "way",
      tags: { golf: "hole", ref: "3" },
      geometry: [{ lat: BASE_LAT, lon: BASE_LON }, null, { lat: greenLat, lon: BASE_LON }],
    };
    const result = extractHoleGreens([clipped, green(greenLat, BASE_LON)]);
    expect(result).toHaveLength(1);
    expect(result[0].lengthM).toBeCloseTo(300, 0);
  });

  it("skips a degenerate way with only one point", () => {
    const single: OverpassElement = {
      type: "way",
      tags: { golf: "hole", ref: "4" },
      geometry: [{ lat: BASE_LAT, lon: BASE_LON }],
    };
    expect(extractHoleGreens([single, green(BASE_LAT, BASE_LON)])).toEqual([]);
  });

  it("returns holes sorted by number regardless of input order", () => {
    const elements: OverpassElement[] = [];
    for (const n of [5, 1, 3]) {
      const greenLat = BASE_LAT + n * 400 * M;
      elements.push(hole(String(n), greenLat - 300 * M, greenLat));
      elements.push(green(greenLat, BASE_LON));
    }
    expect(extractHoleGreens(elements).map((h) => h.number)).toEqual([1, 3, 5]);
  });

  it("ignores unrelated golf features like fairways and bunkers", () => {
    const greenLat = BASE_LAT + 300 * M;
    const fairway: OverpassElement = {
      type: "way",
      tags: { golf: "fairway" },
      geometry: [
        { lat: BASE_LAT, lon: BASE_LON },
        { lat: greenLat, lon: BASE_LON },
      ],
    };
    const result = extractHoleGreens([
      fairway,
      hole("1", BASE_LAT, greenLat),
      green(greenLat, BASE_LON),
    ]);
    expect(result).toHaveLength(1);
  });
});
