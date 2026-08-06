"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOnline = () => navigator.onLine;
// Assume online while prerendering, so the banner never flashes into the
// static HTML.
const isOnlineOnServer = () => true;

/**
 * Tells the user when they're offline, so a failed course search reads as
 * "no signal" rather than "this app is broken". Everything else — scoring,
 * stats, handicap — keeps working, so the message says so.
 *
 * navigator.onLine is an external store, so it's read through
 * useSyncExternalStore rather than mirrored into state from an effect.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, isOnlineOnServer);

  if (online) return null;

  return (
    <div
      role="status"
      className="bg-amber-500/15 text-amber-300 text-xs text-center px-4 py-2 border-b border-amber-500/25"
    >
      Offline — scoring and stats still work. Course search needs a connection.
    </div>
  );
}
