"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SwingDetail from "../SwingDetail";

// Query param rather than /swing/[id] so this is a single static document the
// service worker can precache — see the note in src/app/round/page.tsx.
function SwingFromQuery() {
  const sessionId = useSearchParams().get("id");

  if (!sessionId) {
    return (
      <div className="space-y-3">
        <p className="text-neutral-400">No swing session selected.</p>
        <Link href="/swing" className="text-green-400 underline">
          Back to swing analysis
        </Link>
      </div>
    );
  }

  return <SwingDetail sessionId={sessionId} />;
}

export default function SwingSessionPage() {
  return (
    <Suspense fallback={<p className="text-neutral-400">Loading…</p>}>
      <SwingFromQuery />
    </Suspense>
  );
}
