"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { saveCourse } from "@/lib/repo";
import { Button, Card, Input } from "@/components/ui";
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
  const savedCourses = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return requireDb().courses.orderBy("name").toArray();
  }, [], []);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [searchFailed, setSearchFailed] = useState(false);

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
        <p className="text-neutral-400 text-sm mt-1">
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
              className="rounded-lg border border-neutral-800 p-4 flex flex-col gap-2"
            >
              <div>
                <div className="font-medium">{course.name}</div>
                <div className="text-xs text-neutral-500">
                  {[course.city, course.state, course.country].filter(Boolean).join(", ")}
                </div>
              </div>
              <div className="text-xs text-neutral-400">
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
                onClick={() => addResultToLibrary(course)}
              >
                {savedKeys.has(identity(course)) ? "In your library" : "Add to my courses"}
              </Button>
            </div>
          ))}
          {results.length === 0 && !searching && !searchFailed && (
            <p className="text-sm text-neutral-500">No courses found.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-medium">My courses</h2>
          <Button variant="secondary" onClick={() => setShowManualForm((s) => !s)}>
            {showManualForm ? "Cancel" : "Add manually"}
          </Button>
        </div>

        {showManualForm && (
          <ManualCourseForm onSaved={() => setShowManualForm(false)} />
        )}

        <ul className="mt-4 divide-y divide-neutral-800">
          {(savedCourses ?? []).map((c) => (
            <li key={c.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-neutral-500">
                  {[c.city, c.state].filter(Boolean).join(", ")} · {c.tees.length} tee
                  {c.tees.length === 1 ? "" : "s"}
                </div>
              </div>
            </li>
          ))}
          {(savedCourses ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 py-3">
              No courses saved yet — search above or add one manually.
            </p>
          )}
        </ul>
      </Card>
    </div>
  );
}

function ManualCourseForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [teeName, setTeeName] = useState("White");
  const [rating, setRating] = useState("72.0");
  const [slope, setSlope] = useState("113");
  const [pars, setPars] = useState<string[]>(Array(18).fill("4"));
  const [saving, setSaving] = useState(false);

  const totalPar = pars.reduce((sum, p) => sum + (parseInt(p, 10) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCourse({
        name,
        city: city || undefined,
        state: state || undefined,
        source: "manual",
        tees: [
          {
            name: teeName || "White",
            rating: parseFloat(rating) || 72,
            slope: parseInt(slope, 10) || 113,
          },
        ],
        holes: pars.map((p, i) => ({
          number: i + 1,
          par: parseInt(p, 10) || 4,
        })),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-neutral-800 pt-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-neutral-400">Course name</span>
          <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-neutral-400">City</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} className="w-full" />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-neutral-400">State</span>
          <Input value={state} onChange={(e) => setState(e.target.value)} className="w-full" />
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-neutral-400">Tee name</span>
          <Input value={teeName} onChange={(e) => setTeeName(e.target.value)} className="w-full" />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-neutral-400">Course rating</span>
          <Input
            type="number"
            step="0.1"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-neutral-400">Slope rating</span>
          <Input
            type="number"
            value={slope}
            onChange={(e) => setSlope(e.target.value)}
            className="w-full"
          />
        </label>
      </div>

      <div>
        <div className="text-neutral-400 text-sm mb-2">
          Hole pars <span className="text-neutral-600">(total par {totalPar})</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
          {pars.map((p, i) => (
            <label key={i} className="text-xs text-center space-y-1">
              <div className="text-neutral-500">#{i + 1}</div>
              <Input
                type="number"
                inputMode="numeric"
                min={3}
                max={6}
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

      <Button type="submit" disabled={saving || !name} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save course"}
      </Button>
    </form>
  );
}
