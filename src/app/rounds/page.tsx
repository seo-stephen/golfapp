"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { Card } from "@/components/ui";

export default function RoundsPage() {
  const rounds = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return requireDb().rounds.orderBy("date").reverse().toArray();
  }, [], []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rounds</h1>
        <p className="text-neutral-400 text-sm mt-1">Your round history.</p>
      </div>

      <Card>
        <ul className="divide-y divide-neutral-800">
          {(rounds ?? []).map((r) => {
            // Compare against the par of ENTERED holes only, matching the round
            // detail page — otherwise a part-played round reads as wildly under par.
            const entered = r.holeScores.filter((h) => h.strokes != null);
            const strokes = entered.reduce((s, h) => s + (h.strokes ?? 0), 0);
            const par = entered.reduce((s, h) => s + h.par, 0);
            const diff = strokes - par;
            return (
              <li key={r.id}>
                <Link
                  href={`/round?id=${r.id}`}
                  className="flex items-center justify-between py-3 min-h-14 active:opacity-60 sm:hover:text-green-400"
                >
                  <div>
                    <div className="font-medium">{r.courseName}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(r.date).toLocaleDateString()} · {r.teeName}
                      {!r.completed && (
                        <span className="ml-2 text-amber-400">in progress</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{strokes || "—"}</div>
                    <div className="text-neutral-500 text-xs">
                      {strokes ? (diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff) : ""}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {(rounds ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 py-3">
              No rounds yet —{" "}
              <Link href="/round/new" className="text-green-400 underline">
                start one
              </Link>
              .
            </p>
          )}
        </ul>
      </Card>
    </div>
  );
}
