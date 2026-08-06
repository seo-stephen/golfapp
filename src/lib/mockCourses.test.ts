import { describe, expect, it } from "vitest";
import { MOCK_COURSES, searchMockCourses } from "./mockCourses";

describe("MOCK_COURSES", () => {
  it.each(MOCK_COURSES.map((c) => [c.name, c] as const))(
    "%s has exactly 18 holes numbered 1-18",
    (_name, course) => {
      expect(course.holes).toHaveLength(18);
      expect(course.holes.map((h) => h.number)).toEqual(
        Array.from({ length: 18 }, (_, i) => i + 1)
      );
    }
  );

  it.each(MOCK_COURSES.map((c) => [c.name, c] as const))(
    "%s has a plausible total par (68-74) and per-hole pars of 3-5",
    (_name, course) => {
      const total = course.holes.reduce((s, h) => s + h.par, 0);
      expect(total).toBeGreaterThanOrEqual(68);
      expect(total).toBeLessThanOrEqual(74);
      for (const h of course.holes) {
        expect(h.par).toBeGreaterThanOrEqual(3);
        expect(h.par).toBeLessThanOrEqual(5);
      }
    }
  );

  it.each(MOCK_COURSES.map((c) => [c.name, c] as const))(
    "%s has at least one tee with a usable rating and slope",
    (_name, course) => {
      expect(course.tees.length).toBeGreaterThan(0);
      for (const t of course.tees) {
        expect(t.name).toBeTruthy();
        expect(Number.isFinite(t.rating)).toBe(true);
        // Slope is defined by the Rules of Handicapping to fall in 55-155.
        expect(t.slope).toBeGreaterThanOrEqual(55);
        expect(t.slope).toBeLessThanOrEqual(155);
      }
    }
  );

  it("has unique ids", () => {
    const ids = MOCK_COURSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("searchMockCourses", () => {
  it("returns everything for an empty or whitespace query", () => {
    expect(searchMockCourses("")).toHaveLength(MOCK_COURSES.length);
    expect(searchMockCourses("   ")).toHaveLength(MOCK_COURSES.length);
  });

  it("matches on name, city, and state, case-insensitively", () => {
    expect(searchMockCourses("pebble").map((c) => c.name)).toContain(
      "Pebble Beach Golf Links"
    );
    expect(searchMockCourses("FARMINGDALE").map((c) => c.name)).toContain(
      "Bethpage Black Course"
    );
    expect(searchMockCourses("tx").map((c) => c.name)).toContain(
      "Sample Municipal Golf Course"
    );
  });

  it("returns an empty list for no match rather than throwing", () => {
    expect(searchMockCourses("zzzzz-no-such-course")).toEqual([]);
  });

  it("does not throw when a course has no city or state", () => {
    // Guards the optional-chaining in the filter against undefined fields.
    expect(() => searchMockCourses("anything")).not.toThrow();
  });
});
