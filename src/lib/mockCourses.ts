import type { Course } from "@/types";

// Bundled fallback data used when GOLF_COURSE_API_KEY isn't configured, so
// the course search / round flows work out of the box. Ratings/slopes here
// are illustrative approximations for well-known courses, not official
// USGA figures — swap in real data once a GolfCourseAPI.com key is added.

function holes(pars: number[]): Course["holes"] {
  return pars.map((par, i) => ({ number: i + 1, par }));
}

export const MOCK_COURSES: Course[] = [
  {
    id: "mock-pebble-beach",
    name: "Pebble Beach Golf Links",
    city: "Pebble Beach",
    state: "CA",
    country: "USA",
    source: "manual",
    tees: [
      { name: "Black", rating: 74.9, slope: 144, yardage: 6828 },
      { name: "Blue", rating: 72.4, slope: 135, yardage: 6350 },
    ],
    holes: holes([4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5]),
    createdAt: 0,
  },
  {
    id: "mock-bethpage-black",
    name: "Bethpage Black Course",
    city: "Farmingdale",
    state: "NY",
    country: "USA",
    source: "manual",
    tees: [
      { name: "Black", rating: 76.6, slope: 148, yardage: 7468 },
      { name: "Blue", rating: 73.0, slope: 132, yardage: 6684 },
    ],
    holes: holes([4, 4, 5, 4, 4, 3, 5, 4, 3, 4, 4, 4, 3, 5, 4, 4, 3, 4]),
    createdAt: 0,
  },
  {
    id: "mock-tpc-sawgrass",
    name: "TPC Sawgrass — Stadium Course",
    city: "Ponte Vedra Beach",
    state: "FL",
    country: "USA",
    source: "manual",
    tees: [
      { name: "Championship", rating: 76.0, slope: 155, yardage: 7275 },
      { name: "Blue", rating: 72.5, slope: 137, yardage: 6532 },
    ],
    holes: holes([4, 5, 4, 3, 4, 4, 4, 3, 5, 4, 5, 4, 3, 4, 4, 4, 3, 5]),
    createdAt: 0,
  },
  {
    id: "mock-st-andrews",
    name: "St Andrews — Old Course",
    city: "St Andrews",
    state: "Fife",
    country: "Scotland",
    source: "manual",
    tees: [
      { name: "Championship", rating: 73.1, slope: 132, yardage: 7305 },
      { name: "Medal", rating: 70.9, slope: 126, yardage: 6721 },
    ],
    holes: holes([4, 4, 4, 4, 5, 4, 4, 3, 4, 4, 4, 4, 4, 5, 4, 4, 3, 4]),
    createdAt: 0,
  },
  {
    id: "mock-sample-muni",
    name: "Sample Municipal Golf Course",
    city: "Anytown",
    state: "TX",
    country: "USA",
    source: "manual",
    tees: [{ name: "White", rating: 69.5, slope: 118, yardage: 6200 }],
    holes: holes([4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5]),
    createdAt: 0,
  },
];

export function searchMockCourses(query: string): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_COURSES;
  return MOCK_COURSES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q)
  );
}
