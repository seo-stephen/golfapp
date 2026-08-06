"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { startRound } from "@/lib/repo";
import { Button, Card, Select } from "@/components/ui";

export default function NewRoundPage() {
  const router = useRouter();
  const courses = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return requireDb().courses.orderBy("name").toArray();
  }, [], []);

  const [courseId, setCourseId] = useState("");
  const [teeName, setTeeName] = useState("");
  const [starting, setStarting] = useState(false);

  const selectedCourse = (courses ?? []).find((c) => c.id === courseId);

  async function handleStart() {
    if (!selectedCourse) return;
    setStarting(true);
    try {
      // A tee-less course falls back inside startRound; don't index tees[0] here.
      const round = await startRound(
        selectedCourse,
        teeName || selectedCourse.tees[0]?.name || ""
      );
      router.push(`/round?id=${round.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Start a round</h1>
        <p className="text-cream-400 text-sm mt-1">
          Pick a course and tee to begin tracking your scorecard.
        </p>
      </div>

      <Card className="space-y-4">
        {(courses ?? []).length === 0 ? (
          <p className="text-sm text-cream-400">
            You don&apos;t have any saved courses yet. Add one on the{" "}
            <a href="/courses" className="text-kelly-400 underline">
              Courses
            </a>{" "}
            page first.
          </p>
        ) : (
          <>
            <label className="block text-sm space-y-1">
              <span className="text-cream-400">Course</span>
              <Select
                className="w-full"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setTeeName("");
                }}
              >
                <option value="">Select a course…</option>
                {(courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>

            {selectedCourse && selectedCourse.tees.length > 0 && (
              <label className="block text-sm space-y-1">
                <span className="text-cream-400">Tee</span>
                <Select
                  className="w-full"
                  value={teeName || selectedCourse.tees[0].name}
                  onChange={(e) => setTeeName(e.target.value)}
                >
                  {selectedCourse.tees.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} — rating {t.rating} / slope {t.slope}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {selectedCourse && selectedCourse.tees.length === 0 && (
              <p className="text-xs text-amber-400/90">
                This course has no tee ratings — the round will use a default rating of
                72.0 / slope 113, so its handicap differential will be approximate.
              </p>
            )}

            <Button
              disabled={!selectedCourse || starting}
              onClick={handleStart}
              className="w-full sm:w-auto"
            >
              {starting ? "Starting…" : "Start round"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
