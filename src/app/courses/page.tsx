"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { saveCourse, updateCourse } from "@/lib/repo";
import { Button, Card, Input } from "@/components/ui";
import { burstOriginFromEvent, useGolfBallBurst } from "@/components/GolfBallBurst";
import type { Course } from "@/types";

interface SearchResponse {
  courses?: Course[];
  note?: string;
}

async function fetchCourses(q: string): Promise<SearchResponse> {
  const res = await fetch(`/api/courses/search?q=${encodeURIComponent(q)}`);
  return res.json();
}

export default function CoursesPage() {
  const burst = useGolfBallBurst();
  const savedCourses = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return requireDb().courses.orderBy("name").toArray();
  }, [], []);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  // "new" shows the blank add form; a Course shows that course's edit form
  // inline in the list; null shows neither. Mutually exclusive on purpose —
  // editing two courses (or adding while editing) at once invites confusion
  // over which form's Save button does what.
  const [formTarget, setFormTarget] = useState<Course | "new" | null>(null);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());

  async function runSearch(q: string) {
    setSearching(true);
    setSearchFailed(false);
    try {
      const data = await fetchCourses(q);
      setResults(data.courses ?? []);
      setNote(data.note ?? null);
    } catch {
      // Offline or the host is unreachable. Say so — rendering "No courses
      // found" would claim the search legitimately came back empty.
      setSearchFailed(true);
      setResults([]);
      setNote(null);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchCourses("")
      .then((data) => {
        if (cancelled) return;
        setResults(data.courses ?? []);
        setNote(data.note ?? null);
      })
      .catch(() => {
        if (!cancelled) setSearchFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Saved courses get a fresh local id, so identity across search results and
  // the library is keyed on the upstream id (or the name for manual entries).
  const identity = (c: Course) => c.externalId ?? c.name.toLowerCase();
  const savedKeys = new Set((savedCourses ?? []).map(identity));

  async function addResultToLibrary(course: Course) {
    const key = identity(course);
    // savedKeys comes from a live query that lags the write, so a fast double
    // tap would slip past it and save the course twice. Latch synchronously.
    if (savedKeys.has(key) || addingKeys.has(key)) return;
    setAddingKeys((prev) => new Set(prev).add(key));
    try {
      await saveCourse({
        name: course.name,
        city: course.city,
        state: course.state,
        country: course.country,
        source: course.source,
        externalId: course.externalId,
        tees: course.tees,
        holes: course.holes,
        parsAreEstimated: course.parsAreEstimated,
      });
    } finally {
      setAddingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Courses</h1>
        <p className="text-cream-400 text-sm mt-1">
          Search for a course to add to your library, or enter one manually.
        </p>
      </div>

      <Card>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
        >
          <Input
            type="search"
            enterKeyHint="search"
            autoCapitalize="words"
            placeholder="Course, city, or state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0"
          />
          <Button type="submit" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
        {note && !searchFailed && (
          <p className="text-xs text-amber-400/80 mt-3">{note}</p>
        )}
        {searchFailed && (
          <p className="text-xs text-red-400 mt-3">
            Couldn&apos;t reach course search — you may be offline. Courses already in
            your library still work, and you can add one manually below.
          </p>
        )}

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {results.map((course) => (
            <div
              key={course.id}
              className="rounded-lg border border-pine-800 p-4 flex flex-col gap-2"
            >
              <div>
                <div className="font-medium">{course.name}</div>
                <div className="text-xs text-cream-500">
                  {[course.city, course.state, course.country].filter(Boolean).join(", ")}
                </div>
              </div>
              <div className="text-xs text-cream-400">
                {course.tees.map((t) => (
                  <span key={t.name} className="mr-3">
                    {t.name}: {t.rating}/{t.slope}
                  </span>
                ))}
              </div>
              {course.parsAreEstimated && (
                <p className="text-xs text-amber-400/80">
                  No hole data upstream — pars default to 4. Edit them after adding.
                </p>
              )}
              <Button
                variant="secondary"
                className="self-start"
                disabled={
                  savedKeys.has(identity(course)) || addingKeys.has(identity(course))
                }
                onClick={(e) => {
                  burst(burstOriginFromEvent(e));
                  addResultToLibrary(course);
                }}
              >
                {savedKeys.has(identity(course)) ? "In your library" : "Add to my courses"}
              </Button>
            </div>
          ))}
          {results.length === 0 && !searching && !searchFailed && (
            <p className="text-sm text-cream-500">No courses found.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-medium">My courses</h2>
          <Button
            variant="secondary"
            onClick={() => setFormTarget((t) => (t === "new" ? null : "new"))}
          >
            {formTarget === "new" ? "Cancel" : "Add manually"}
          </Button>
        </div>

        {formTarget === "new" && (
          <CourseForm key="new" onSaved={() => setFormTarget(null)} />
        )}

        <ul className="mt-4 divide-y divide-pine-800">
          {(savedCourses ?? []).map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-cream-500">
                    {[c.city, c.state].filter(Boolean).join(", ")} · {c.tees.length} tee
                    {c.tees.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() =>
                    setFormTarget((t) =>
                      t !== "new" && t?.id === c.id ? null : c
                    )
                  }
                >
                  {formTarget !== "new" && formTarget?.id === c.id ? "Cancel" : "Edit"}
                </Button>
              </div>
              {formTarget !== "new" && formTarget?.id === c.id && (
                <CourseForm
                  key={c.id}
                  initial={c}
                  onSaved={() => setFormTarget(null)}
                  onCancel={() => setFormTarget(null)}
                />
              )}
            </li>
          ))}
          {(savedCourses ?? []).length === 0 && (
            <p className="text-sm text-cream-500 py-3">
              No courses saved yet — search above or add one manually.
            </p>
          )}
        </ul>
      </Card>
    </div>
  );
}

const PAR_PRESETS = [3, 4, 5];

function CourseForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Course;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [tees, setTees] = useState(
    (initial?.tees.length ? initial.tees : [{ name: "White", rating: 72, slope: 113 }]).map(
      (t) => ({ name: t.name, rating: String(t.rating), slope: String(t.slope) })
    )
  );
  const initialPars = initial
    ? [...initial.holes].sort((a, b) => a.number - b.number).map((h) => String(h.par))
    : Array(18).fill("4");
  const [pars, setPars] = useState<string[]>(initialPars);
  const [bulkPar, setBulkPar] = useState("4");
  const [saving, setSaving] = useState(false);

  const totalPar = pars.reduce((sum, p) => sum + (parseInt(p, 10) || 0), 0);

  function applyParToAll(value: number) {
    setPars(Array(18).fill(String(value)));
  }

  function updateTee(i: number, patch: Partial<{ name: string; rating: string; slope: string }>) {
    setTees((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        city: city || undefined,
        state: state || undefined,
        tees: tees.map((t) => ({
          name: t.name || "White",
          rating: parseFloat(t.rating) || 72,
          slope: parseInt(t.slope, 10) || 113,
        })),
        holes: pars.map((p, i) => ({
          number: i + 1,
          par: parseInt(p, 10) || 4,
        })),
      };
      if (initial) {
        // Editing keeps the original source/externalId — correcting a
        // search-imported course's pars doesn't make it a different course.
        await updateCourse(initial.id, payload);
      } else {
        await saveCourse({ ...payload, source: "manual" });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-pine-800 pt-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-cream-400">Course name</span>
          <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-cream-400">City</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} className="w-full" />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-cream-400">State</span>
          <Input value={state} onChange={(e) => setState(e.target.value)} className="w-full" />
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-cream-400 text-sm">Tees</span>
        {tees.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <label className="text-xs space-y-1">
              <span className="text-cream-500">Name</span>
              <Input value={t.name} onChange={(e) => updateTee(i, { name: e.target.value })} className="w-full" />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-cream-500">Rating</span>
              <Input
                type="number"
                step="0.1"
                value={t.rating}
                onChange={(e) => updateTee(i, { rating: e.target.value })}
                className="w-full"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-cream-500">Slope</span>
              <Input
                type="number"
                value={t.slope}
                onChange={(e) => updateTee(i, { slope: e.target.value })}
                className="w-full"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={tees.length === 1}
              onClick={() => setTees((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label="Remove tee"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setTees((prev) => [...prev, { name: "", rating: "72.0", slope: "113" }])
          }
        >
          Add tee
        </Button>
      </div>

      <div>
        <div className="text-cream-400 text-sm mb-2">
          Hole pars <span className="text-cream-600">(total par {totalPar})</span>
        </div>

        {/* The whole point: a par-3 course (or any uniform layout) is one
            tap, not 18 individual edits. */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {PAR_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyParToAll(p)}
              className="min-h-9 px-3 rounded-full text-xs font-medium bg-pine-800 text-cream-300 hover:bg-pine-700"
            >
              All par {p}
            </button>
          ))}
          <span className="text-cream-600 text-xs px-1">or</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={bulkPar}
            onChange={(e) => setBulkPar(e.target.value)}
            className="w-14 text-center px-1"
            aria-label="Custom par to apply to all holes"
          />
          <button
            type="button"
            onClick={() => applyParToAll(parseInt(bulkPar, 10) || 4)}
            className="min-h-9 px-3 rounded-full text-xs font-medium bg-pine-800 text-cream-300 hover:bg-pine-700"
          >
            Apply to all 18
          </button>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
          {pars.map((p, i) => (
            <label key={i} className="text-xs text-center space-y-1">
              <div className="text-cream-500">#{i + 1}</div>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={9}
                value={p}
                onChange={(e) => {
                  const next = [...pars];
                  next[i] = e.target.value;
                  setPars(next);
                }}
                className="w-full text-center px-1"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !name} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Save course"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
