"use client";

import { useEffect, useState } from "react";
import type { LatLon } from "@/types";

export type GeoStatus = "idle" | "locating" | "active" | "error";

export interface GeoState {
  status: GeoStatus;
  coords: LatLon | null;
  /** Reported accuracy radius in metres — surfaced to the user, never hidden. */
  accuracyM: number | null;
  /** Epoch ms of the last fix, so the UI can show a stale reading as stale. */
  at: number | null;
  message: string | null;
}

const IDLE: GeoState = {
  status: "idle",
  coords: null,
  accuracyM: null,
  at: null,
  message: null,
};

/**
 * Why geolocation cannot work in this context, or null if it should.
 *
 * The secure-context check carries most of the weight here. Chrome and Safari
 * both report PERMISSION_DENIED on a plain-http origin, so without checking
 * first the app blames the user's permissions for what is really the address
 * they opened — permissions look correctly granted, because they are.
 * `http://localhost` counts as secure; `http://192.168.x.x` does not, which is
 * exactly the case when testing from a phone over Wi-Fi.
 */
export function geoBlockedReason(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  if (!navigator.geolocation) return "This device has no location support.";
  if (!window.isSecureContext) {
    return (
      "Location needs an https:// address. A plain http:// page is blocked, and " +
      "browsers report that as a permission error even when permission is granted. " +
      "Use `npm run dev:phone` or a deployed URL."
    );
  }
  return null;
}

/**
 * Live device position while `enabled`.
 *
 * Opt-in rather than automatic: watchPosition with high accuracy keeps the GPS
 * radio running, and over a four-hour round that is a real amount of battery on
 * a phone that also has to survive the drive home.
 *
 * Only the watch callbacks call setState — idle, locating, and the blocked cases
 * are all derived below. Mirroring those into state from inside the effect would
 * just cause an extra render pass on every toggle.
 */
export function useGeoPosition(enabled: boolean): GeoState {
  const [fix, setFix] = useState<GeoState | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Don't even ask on a blocked origin: the browser's own error would be
    // misleading, and the derived state below already explains the real reason.
    if (geoBlockedReason() != null) return;

    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({
          status: "active",
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          accuracyM: pos.coords.accuracy,
          at: pos.timestamp,
          message: null,
        });
      },
      (err) => {
        // A denial needs a follow-up query to be described accurately, so it
        // takes the async path; everything else is knowable from the code alone.
        if (err.code === err.PERMISSION_DENIED) {
          void diagnosePermissionDenied().then((message) => {
            if (!cancelled) setFix({ ...IDLE, status: "error", message });
          });
          return;
        }
        setFix({ ...IDLE, status: "error", message: describeGeoError(err) });
      },
      // maximumAge 0 because a cached fix from the previous hole is worse than
      // no fix at all — it would render a confidently wrong yardage.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      // Drop the last fix, so re-enabling never flashes a stale yardage from
      // wherever the phone was when tracking was switched off.
      setFix(null);
    };
  }, [enabled]);

  if (!enabled) return IDLE;

  const blocked = geoBlockedReason();
  if (blocked != null) return { ...IDLE, status: "error", message: blocked };

  return fix ?? { ...IDLE, status: "locating" };
}

function describeGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      // Handled asynchronously by diagnosePermissionDenied, which can tell a
      // site denial apart from an OS-level block. Kept here for completeness.
      return SITE_DENIED_MESSAGE;
    case err.POSITION_UNAVAILABLE:
      return "No GPS fix yet. This needs a clear view of the sky.";
    case err.TIMEOUT:
      return "Timed out waiting for a GPS fix.";
    default:
      return err.message || "Location unavailable.";
  }
}

const SITE_DENIED_MESSAGE =
  "Location permission denied for this site. On iOS, an app added to your Home Screen " +
  "asks separately from Safari, so it may need granting again there.";

/**
 * PERMISSION_DENIED is ambiguous: it means either this site was denied, or
 * something above the browser refused it. On macOS, System Settings > Privacy &
 * Security > Location Services being off for the browser looks identical through
 * the Geolocation API — which is exactly the case where a user checks the site
 * permission, finds it granted, and is told otherwise.
 *
 * The Permissions API separates them: "granted" alongside a denial means the
 * block is upstream of this site, so the message should point at the OS instead.
 */
async function diagnosePermissionDenied(): Promise<string> {
  const siteState = await queryGeolocationPermission();
  if (siteState === "granted") {
    return (
      "This site has location permission, but the browser was still refused — so " +
      "something above it is blocking. On macOS check System Settings > Privacy & " +
      "Security > Location Services (and that your browser is enabled in that list)."
    );
  }
  return SITE_DENIED_MESSAGE;
}

async function queryGeolocationPermission(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    // Older Safari throws on permission names it doesn't recognise.
    return null;
  }
}
