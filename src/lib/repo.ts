import { v4 as uuid } from "uuid";
import { requireDb } from "@/lib/db";
import { computeDifferential } from "@/lib/handicap";
import type {
  Course,
  HoleScore,
  PuttingSession,
  Round,
  Shot,
  ShotResult,
  SwingSession,
  Tee,
} from "@/types";

export function emptyHoleScores(holes: Course["holes"]): HoleScore[] {
  return holes
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((h) => ({
      number: h.number,
      par: h.par,
      strokes: null,
      putts: null,
      fairwayHit: h.par === 3 ? null : null,
      gir: null,
      penalties: null,
    }));
}

/** Double bogey or worse — for a beginner, avoiding these matters more than GIR%. */
export function isBlowUpHole(h: HoleScore): boolean {
  return h.strokes != null && h.strokes - h.par >= 2;
}

export async function saveCourse(
  course: Omit<Course, "id" | "createdAt">
): Promise<Course> {
  const db = requireDb();
  const full: Course = { ...course, id: uuid(), createdAt: Date.now() };
  await db.courses.put(full);
  return full;
}

export async function listCourses(): Promise<Course[]> {
  const db = requireDb();
  return db.courses.orderBy("name").toArray();
}

export async function getCourse(id: string): Promise<Course | undefined> {
  const db = requireDb();
  return db.courses.get(id);
}

export async function updateCourse(
  id: string,
  patch: Partial<Omit<Course, "id" | "createdAt">>
): Promise<void> {
  const db = requireDb();
  await db.courses.update(id, patch);
}

/** Neutral fallback: rating = par, slope = the WHS standard 113. */
const DEFAULT_TEE: Tee = { name: "Default", rating: 72, slope: 113 };

export async function startRound(
  course: Course,
  teeName: string
): Promise<Round> {
  const db = requireDb();
  // A course can reach here with no tees (an API record that mapped badly), and
  // tees[0].name would then throw and take the whole page down.
  const tee =
    course.tees.find((t) => t.name === teeName) ?? course.tees[0] ?? DEFAULT_TEE;
  const round: Round = {
    id: uuid(),
    courseId: course.id,
    courseName: course.name,
    teeName: tee.name,
    courseRating: tee.rating,
    slopeRating: tee.slope,
    date: Date.now(),
    holeScores: emptyHoleScores(course.holes),
    completed: false,
    differential: null,
    createdAt: Date.now(),
  };
  await db.rounds.put(round);
  return round;
}

export async function getRound(id: string): Promise<Round | undefined> {
  const db = requireDb();
  return db.rounds.get(id);
}

export async function updateRoundHole(
  roundId: string,
  holeNumber: number,
  patch: Partial<HoleScore>
): Promise<void> {
  const db = requireDb();
  // Read-modify-write on the whole holeScores array, so it must be atomic —
  // fast entry across holes would otherwise let one write clobber another.
  await db.transaction("rw", db.rounds, async () => {
    const round = await db.rounds.get(roundId);
    if (!round) return;
    const holeScores = round.holeScores.map((h) =>
      h.number === holeNumber ? { ...h, ...patch } : h
    );
    await db.rounds.update(roundId, { holeScores });
  });
}

/**
 * Adjusts a hole's strokes by a delta, reading the current value inside the
 * transaction. Rapid taps must not compute from the value React last
 * rendered — that value can lag the database and silently drop increments.
 */
export async function bumpRoundHole(
  roundId: string,
  holeNumber: number,
  field: "strokes",
  delta: number
): Promise<void> {
  const db = requireDb();
  await db.transaction("rw", db.rounds, async () => {
    const round = await db.rounds.get(roundId);
    if (!round) return;
    const holeScores = round.holeScores.map((h) => {
      if (h.number !== holeNumber) return h;
      const current = h[field] ?? 0;
      const next = current + delta;
      return { ...h, [field]: next <= 0 ? null : next };
    });
    await db.rounds.update(roundId, { holeScores });
  });
}

export async function finishRound(roundId: string): Promise<Round | undefined> {
  const db = requireDb();
  await db.transaction("rw", db.rounds, async () => {
    const round = await db.rounds.get(roundId);
    if (!round) return;
    // A differential is only meaningful for a complete 18-hole score. Summing
    // partial rounds would treat un-entered holes as 0 strokes and produce a
    // wildly negative differential, which then becomes the "lowest" and
    // permanently drags the handicap index down.
    const differential = isScoreComplete(round) ? differentialFor(round) : null;
    await db.rounds.update(roundId, { completed: true, differential });
  });
  return db.rounds.get(roundId);
}

/** True when every hole has a stroke count recorded. */
export function isScoreComplete(round: Round): boolean {
  return (
    round.holeScores.length > 0 &&
    round.holeScores.every((h) => h.strokes != null && h.strokes > 0)
  );
}

export function totalStrokesFor(round: Round): number {
  return round.holeScores.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
}

function differentialFor(round: Round): number {
  return computeDifferential(
    totalStrokesFor(round),
    round.courseRating,
    round.slopeRating
  );
}

export async function listRounds(): Promise<Round[]> {
  const db = requireDb();
  const all = await db.rounds.orderBy("date").reverse().toArray();
  return all;
}

export async function deleteRound(id: string): Promise<void> {
  const db = requireDb();
  await db.rounds.delete(id);
}

export async function saveSwingSession(
  session: Omit<SwingSession, "id" | "createdAt">
): Promise<SwingSession> {
  const db = requireDb();
  const full: SwingSession = { ...session, id: uuid(), createdAt: Date.now() };
  await db.swingSessions.put(full);
  return full;
}

export async function listSwingSessions(): Promise<SwingSession[]> {
  const db = requireDb();
  return db.swingSessions.orderBy("date").reverse().toArray();
}

export async function getSwingSession(
  id: string
): Promise<SwingSession | undefined> {
  const db = requireDb();
  return db.swingSessions.get(id);
}

export async function deleteSwingSession(id: string): Promise<void> {
  const db = requireDb();
  await db.swingSessions.delete(id);
}

export async function logShot(input: {
  club: string;
  distanceYds: number;
  result: ShotResult | null;
}): Promise<Shot> {
  const db = requireDb();
  const shot: Shot = { ...input, id: uuid(), date: Date.now(), createdAt: Date.now() };
  await db.shots.put(shot);
  return shot;
}

export async function listShots(): Promise<Shot[]> {
  const db = requireDb();
  return db.shots.orderBy("date").reverse().toArray();
}

export async function deleteShot(id: string): Promise<void> {
  const db = requireDb();
  await db.shots.delete(id);
}

export async function logPuttingSession(input: {
  distanceFt: number;
  attempts: number;
  makes: number;
}): Promise<PuttingSession> {
  const db = requireDb();
  const session: PuttingSession = {
    ...input,
    id: uuid(),
    date: Date.now(),
    createdAt: Date.now(),
  };
  await db.puttingSessions.put(session);
  return session;
}

export async function listPuttingSessions(): Promise<PuttingSession[]> {
  const db = requireDb();
  return db.puttingSessions.orderBy("date").reverse().toArray();
}

export async function deletePuttingSession(id: string): Promise<void> {
  const db = requireDb();
  await db.puttingSessions.delete(id);
}
