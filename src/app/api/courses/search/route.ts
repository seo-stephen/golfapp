import { NextRequest, NextResponse } from "next/server";
import { searchMockCourses } from "@/lib/mockCourses";
import type { Course, CourseHole, Tee } from "@/types";

const API_BASE = "https://api.golfcourseapi.com/v1";

// GolfCourseAPI.com's documented response shape, as best understood without
// a live key to test against — kept loose/defensive so a schema mismatch
// falls back to mock data instead of throwing.
interface ApiHole {
  par?: number;
  yardage?: number;
  handicap?: number;
}
interface ApiTee {
  tee_name?: string;
  course_rating?: number;
  slope_rating?: number;
  total_yards?: number;
  holes?: ApiHole[];
}
interface ApiCourse {
  id?: number | string;
  course_name?: string;
  club_name?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  const apiKey = process.env.GOLF_COURSE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      courses: searchMockCourses(query),
      source: "mock",
      note: "GOLF_COURSE_API_KEY is not set — showing bundled sample courses.",
    });
  }

  try {
    const res = await fetch(
      `${API_BASE}/search?search_query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Key ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error(`GolfCourseAPI responded with status ${res.status}`);
    }
    const data = await res.json();
    const courses = mapApiCourses(data);
    if (courses.length === 0) {
      return NextResponse.json({
        courses: searchMockCourses(query),
        source: "mock",
        note: "No API results for that query — showing bundled sample courses.",
      });
    }
    return NextResponse.json({ courses, source: "api" });
  } catch (err) {
    console.error("GolfCourseAPI search failed, falling back to mock data:", err);
    return NextResponse.json({
      courses: searchMockCourses(query),
      source: "mock",
      note: "Course API request failed — showing bundled sample courses.",
    });
  }
}

function mapApiCourses(data: unknown): Course[] {
  const rawCourses = isRecord(data) && Array.isArray(data.courses)
    ? (data.courses as ApiCourse[])
    : [];

  return rawCourses.map((c, i) => {
    const teeList: ApiTee[] = c.tees?.male?.length
      ? c.tees.male
      : c.tees?.female?.length
        ? c.tees.female
        : [];

    // Rating/slope must be real numbers — a string or null from upstream would
    // otherwise flow into the handicap differential and corrupt it.
    const tees: Tee[] = teeList.length
      ? teeList.map((t) => ({
          name: t.tee_name ?? "Default",
          rating: numberOr(t.course_rating, 72),
          slope: numberOr(t.slope_rating, 113),
          yardage: typeof t.total_yards === "number" ? t.total_yards : undefined,
        }))
      : [{ name: "Default", rating: 72, slope: 113 }];

    const holeSource = teeList[0]?.holes;
    const hasRealHoles = Array.isArray(holeSource) && holeSource.length === 18;
    const holes: CourseHole[] = hasRealHoles
      ? holeSource.map((h, idx) => ({
          number: idx + 1,
          par: numberOr(h.par, 4),
          yardage: typeof h.yardage === "number" ? h.yardage : undefined,
          handicapIndex: typeof h.handicap === "number" ? h.handicap : undefined,
        }))
      : Array.from({ length: 18 }, (_, idx) => ({ number: idx + 1, par: 4 }));

    // Only kept when both are real numbers — a half-present pair would anchor
    // the OSM green lookup at the equator.
    const lat = c.location?.latitude;
    const lon = c.location?.longitude;
    const location =
      typeof lat === "number" && Number.isFinite(lat) &&
      typeof lon === "number" && Number.isFinite(lon)
        ? { lat, lon }
        : undefined;

    return {
      id: `api-${c.id ?? i}`,
      name: c.course_name ?? c.club_name ?? "Unknown Course",
      city: c.location?.city,
      state: c.location?.state,
      country: c.location?.country,
      location,
      // Flag placeholder pars so the UI can tell the user to check them rather
      // than silently presenting 18 par-4s as this course's real scorecard.
      parsAreEstimated: !hasRealHoles,
      source: "api" as const,
      externalId: c.id != null ? String(c.id) : undefined,
      tees,
      holes,
      createdAt: Date.now(),
    };
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
