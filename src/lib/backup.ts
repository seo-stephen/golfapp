import { requireDb } from "@/lib/db";
import type { Course, Round, Shot, SwingSession } from "@/types";

// Everything lives in IndexedDB, which iOS Safari will evict after ~7 days of
// no interaction unless the app is installed to the Home Screen. A season of
// rounds is worth more than that gamble, so make it exportable.

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: "bogeyboys";
  version: number;
  exportedAt: string;
  courses: Course[];
  /** Swing video blobs are deliberately omitted — they are large and replaceable. */
  rounds: Round[];
  swingSessions: Omit<SwingSession, "videoBlob">[];
  /** Optional: absent in backups written before the yardage book existed. */
  shots?: Shot[];
}

export async function buildBackup(exportedAt: string): Promise<BackupFile> {
  const db = requireDb();
  const [courses, rounds, sessions, shots] = await Promise.all([
    db.courses.toArray(),
    db.rounds.toArray(),
    db.swingSessions.toArray(),
    db.shots.toArray(),
  ]);

  return {
    app: "bogeyboys",
    version: BACKUP_VERSION,
    exportedAt,
    courses,
    rounds,
    // Fields are listed explicitly rather than spread-and-omit, so a future
    // large field can't quietly end up inflating every backup.
    swingSessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      durationMs: s.durationMs,
      frames: s.frames,
      metrics: s.metrics,
      notes: s.notes,
      createdAt: s.createdAt,
    })),
    shots,
  };
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === "bogeyboys" &&
    typeof v.version === "number" &&
    Array.isArray(v.courses) &&
    Array.isArray(v.rounds)
  );
}

export interface RestoreResult {
  courses: number;
  rounds: number;
  swingSessions: number;
  shots: number;
}

/**
 * Merges a backup into the current database. Records are keyed by id, so
 * restoring the same file twice is a no-op rather than a duplicate.
 */
export async function restoreBackup(backup: BackupFile): Promise<RestoreResult> {
  const db = requireDb();
  if (backup.version > BACKUP_VERSION) {
    throw new Error(
      `This backup was written by a newer version of BogeyBoys (v${backup.version}).`
    );
  }

  const sessions = (backup.swingSessions ?? []).map((s) => ({
    ...s,
    // Videos aren't in the backup; keep the metrics with an empty placeholder.
    videoBlob: new Blob([], { type: "video/mp4" }),
  })) as SwingSession[];
  const shots = backup.shots ?? [];

  await db.transaction(
    "rw",
    db.courses,
    db.rounds,
    db.swingSessions,
    db.shots,
    async () => {
      if (backup.courses.length) await db.courses.bulkPut(backup.courses);
      if (backup.rounds.length) await db.rounds.bulkPut(backup.rounds);
      if (sessions.length) await db.swingSessions.bulkPut(sessions);
      if (shots.length) await db.shots.bulkPut(shots);
    }
  );

  return {
    courses: backup.courses.length,
    rounds: backup.rounds.length,
    swingSessions: sessions.length,
    shots: shots.length,
  };
}
