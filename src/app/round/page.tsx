"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import RoundDetail from "./RoundDetail";

// The round id is a query parameter rather than a path segment on purpose.
// A dynamic /round/[id] route makes Next render each id on the server, so
// opening a round with no signal fails. As a query param this is ONE static
// document that the service worker precaches and that serves every round
// offline — the id is read on the client and looked up in IndexedDB.
function RoundFromQuery() {
  const roundId = useSearchParams().get("id");

  if (!roundId) {
    return (
      <div className="space-y-3">
        <p className="text-cream-400">No round selected.</p>
        <Link href="/rounds" className="text-kelly-400 underline">
          Back to your rounds
        </Link>
      </div>
    );
  }

  return <RoundDetail roundId={roundId} />;
}

export default function RoundPage() {
  // useSearchParams needs a Suspense boundary for the page to prerender.
  return (
    <Suspense fallback={<p className="text-cream-400">Loading…</p>}>
      <RoundFromQuery />
    </Suspense>
  );
}
