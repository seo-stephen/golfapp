import type { LatLon } from "@/types";

// Geodesy for on-course distance. Pure functions — no browser APIs, so this is
// directly unit-testable and safe to import from anywhere.

/** IUGG mean Earth radius. */
const EARTH_RADIUS_M = 6371008.8;

const YARDS_PER_METER = 1.0936132983377078;

export function metersToYards(meters: number): number {
  return meters * YARDS_PER_METER;
}

export function yardsToMeters(yards: number): number {
  return yards / YARDS_PER_METER;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Great-circle distance. Over a single golf hole this agrees with a planar
 * approximation to within millimetres, but it costs nothing extra and doesn't
 * quietly misbehave at high latitude or across the antimeridian.
 */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = phi2 - phi1;
  const dLambda = toRad(b.lon - a.lon);
  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  // Clamp before asin: rounding on antipodal points can push h just past 1.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing, degrees clockwise from true north. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dLambda = toRad(b.lon - a.lon);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Mean of a ring's vertices.
 *
 * OSM closes a way by repeating its first node as its last, so that duplicate
 * is dropped — otherwise the closing vertex is weighted twice. This is a vertex
 * mean rather than a true area centroid: for a green (small, roughly convex,
 * evenly traced) the two agree within a couple of metres, comfortably inside
 * GPS error, and it avoids needing a winding-aware polygon algorithm.
 */
export function ringCentroid(points: LatLon[]): LatLon | null {
  if (points.length === 0) return null;

  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length > 1 && first.lat === last.lat && first.lon === last.lon) {
    ring.pop();
  }
  if (ring.length === 0) return null;

  return {
    lat: ring.reduce((sum, p) => sum + p.lat, 0) / ring.length,
    lon: ring.reduce((sum, p) => sum + p.lon, 0) / ring.length,
  };
}

/**
 * Nearest candidate to `from`, with its distance and position in the list.
 * Null for an empty list. The index lets a caller tell two equal coordinates
 * apart, which matters when candidates must be assigned exclusively.
 */
export function nearestTo(
  from: LatLon,
  candidates: LatLon[]
): { point: LatLon; index: number; distanceM: number } | null {
  let best: { point: LatLon; index: number; distanceM: number } | null = null;
  candidates.forEach((point, index) => {
    const distanceM = haversineMeters(from, point);
    if (!best || distanceM < best.distanceM) best = { point, index, distanceM };
  });
  return best;
}
