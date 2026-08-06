import { requireDb } from "@/lib/db";
import type { Course, Round, SwingSession } from "@/types";

// Everything lives in IndexedDB, which iOS Safari will evict after ~7 days of
// no interaction unless the app is installed to the Home Screen. A season of
// rounds is worth more than that gamble, so make it exportable.

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: "triplebogey";
  version: number;
  exportedAt: string;
  courses: Course[];
  /** Swing video blobs are deliberately omitted — they are large and replaceable. */
  rounds: Round[];
  swingSessions: Omit<SwingSession, "videoBlob">[];
}

export async function buildBackup(exportedAt: string): Promise<BackupFile> {
  const db = requireDb();
  const [courses, rounds, sessions] = await Promise.all([
    db.courses.toArray(),
    db.rounds.toArray(),
    db.swingSessions.toArray(),
  ]);

  return {
    app: "triplebogey",
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
  };
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === "triplebogey" &&
    typeof v.version === "number" &&
    Array.isArray(v.courses) &&
    Array.isArray(v.rounds)
  );
}

export interface RestoreResult {
  courses: number;
  rounds: number;
  swingSessions: number;
}

/**
 * Merges a backup into the current database. Records are keyed by id, so
 * restoring the same file twice is a no-op rather than a duplicate.
 */
export async function restoreBackup(backup: BackupFile): Promise<RestoreResult> {
  const db = requireDb();
  if (backup.version > BACKUP_VERSION) {
    throw new Error(
      `This backup was written by a newer version of TripleBogey (v${backup.version}).`
    );
  }

  const sessions = (backup.swingSessions ?? []).map((s) => ({
    ...s,
    // Videos aren't in the backup; keep the metrics with an empty placeholder.
    videoBlob: new Blob([], { type: "video/mp4" }),
  })) as SwingSession[];

  await db.transaction("rw", db.courses, db.rounds, db.swingSessions, async () => {
    if (backup.courses.length) await db.courses.bulkPut(backup.courses);
    if (backup.rounds.length) await db.rounds.bulkPut(backup.rounds);
    if (sessions.length) await db.swingSessions.bulkPut(sessions);
  });

  return {
    courses: backup.courses.length,
    rounds: backup.rounds.length,
    swingSessions: sessions.length,
  };
}
