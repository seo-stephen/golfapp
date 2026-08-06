import Dexie, { type EntityTable } from "dexie";
import type { Course, PuttingSession, Round, Shot, SwingSession } from "@/types";

class BogeyBoysDB extends Dexie {
  courses!: EntityTable<Course, "id">;
  rounds!: EntityTable<Round, "id">;
  swingSessions!: EntityTable<SwingSession, "id">;
  shots!: EntityTable<Shot, "id">;
  puttingSessions!: EntityTable<PuttingSession, "id">;

  constructor() {
    super("bogeyboys");

    this.version(1).stores({
      courses: "id, name, source, createdAt",
      rounds: "id, courseId, date, completed, createdAt",
      swingSessions: "id, date, createdAt",
    });

    // v2 drops the `completed` index. Booleans are not valid IndexedDB keys —
    // indexedDB.cmp(true, true) throws DataError — so that index never matched
    // anything, and a later `where("completed")` would have silently returned
    // no rounds. Callers filter completed rounds in memory instead, which is
    // fine at this scale. Dropping an index doesn't touch the stored records.
    this.version(2).stores({
      rounds: "id, courseId, date, createdAt",
    });

    // v3 adds the yardage-book log. `penalties` on HoleScore needs no bump —
    // it lives inside the `rounds` records themselves, not as an index.
    this.version(3).stores({
      shots: "id, date, club, createdAt",
    });

    // v4 adds putting-practice sessions.
    this.version(4).stores({
      puttingSessions: "id, date, distanceFt, createdAt",
    });
  }
}

// IndexedDB only exists in the browser; pages that touch this must be
// client components, but guard construction anyway for SSR safety.
export const db: BogeyBoysDB | null =
  typeof window !== "undefined" ? new BogeyBoysDB() : null;

export function requireDb(): BogeyBoysDB {
  if (!db) {
    throw new Error("Database is only available in the browser");
  }
  return db;
}
