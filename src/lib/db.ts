import Dexie, { type EntityTable } from "dexie";
import type { Course, Round, SwingSession } from "@/types";

class TripleBogeyDB extends Dexie {
  courses!: EntityTable<Course, "id">;
  rounds!: EntityTable<Round, "id">;
  swingSessions!: EntityTable<SwingSession, "id">;

  constructor() {
    super("triplebogey");

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
  }
}

// IndexedDB only exists in the browser; pages that touch this must be
// client components, but guard construction anyway for SSR safety.
export const db: TripleBogeyDB | null =
  typeof window !== "undefined" ? new TripleBogeyDB() : null;

export function requireDb(): TripleBogeyDB {
  if (!db) {
    throw new Error("Database is only available in the browser");
  }
  return db;
}
