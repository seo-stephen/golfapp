import { NextRequest, NextResponse } from "next/server";
import { extractHoleGreens, type OverpassElement } from "@/lib/osm";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// A championship course spans comfortably under 2 km. Keeping the radius tight
// makes the query cheap and limits how often a neighbouring course bleeds in.
const DEFAULT_RADIUS_M = 1500;
const MIN_RADIUS_M = 200;
const MAX_RADIUS_M = 4000;

/**
 * Looks up per-hole green positions from OpenStreetMap around a point.
 *
 * Proxied server-side rather than called from the browser: Overpass is a
 * donated public service that rate-limits and expects an identifying
 * User-Agent, and going through a route keeps that etiquette in one place.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const radius = clampRadius(Number(req.nextUrl.searchParams.get("radius")));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return NextResponse.json(
      { error: "Valid lat and lon query parameters are required." },
      { status: 400 }
    );
  }

  const query = `[out:json][timeout:30];
(
  way["golf"="hole"](around:${radius},${lat},${lon});
  way["golf"="green"](around:${radius},${lat},${lon});
);
out tags geom;`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: {
        "User-Agent": "BogeyBoys/0.1 (personal golf trainer PWA)",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Overpass responded with status ${res.status}`);
    }

    const data: unknown = await res.json();
    const elements: OverpassElement[] =
      typeof data === "object" && data !== null && Array.isArray((data as { elements?: unknown }).elements)
        ? ((data as { elements: OverpassElement[] }).elements)
        : [];

    return NextResponse.json({
      holes: extractHoleGreens(elements),
      // ODbL requires attribution wherever this data is surfaced.
      attribution: "© OpenStreetMap contributors (ODbL)",
    });
  } catch (err) {
    console.error("Overpass hole lookup failed:", err);
    return NextResponse.json(
      {
        error:
          "Couldn't reach OpenStreetMap. Try again, or set greens by hand from the round screen.",
      },
      { status: 502 }
    );
  }
}

function clampRadius(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(value)));
}
