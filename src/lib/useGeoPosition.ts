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
 * Live device position while `enabled`.
 *
 * Opt-in rather than automatic: watchPosition with high accuracy keeps the GPS
 * radio running, and over a four-hour round that is a real amount of battery on
 * a phone that also has to survive the drive home.
 *
 * Only the watch callbacks call setState — idle, locating, and the
 * unsupported-device case are all derived below. Mirroring those into state from
 * inside the effect would just cause an extra render pass on every toggle.
 */
export function useGeoPosition(enabled: boolean): GeoState {
  const [fix, setFix] = useState<GeoState | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

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
        setFix({ ...IDLE, status: "error", message: describeGeoError(err) });
      },
      // maximumAge 0 because a cached fix from the previous hole is worse than
      // no fix at all — it would render a confidently wrong yardage.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      // Drop the last fix, so re-enabling never flashes a stale yardage from
      // wherever the phone was when tracking was switched off.
      setFix(null);
    };
  }, [enabled]);

  if (!enabled) return IDLE;
  if (typeof navigator !== "undefined" && !navigator.geolocation) {
    return { ...IDLE, status: "error", message: "This device has no location support." };
  }
  return fix ?? { ...IDLE, status: "locating" };
}

function describeGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied — enable it for this site to see distances.";
    case err.POSITION_UNAVAILABLE:
      // Also what an insecure (plain http://) origin reports on some browsers,
      // which is the likeliest cause when testing from a phone over Wi-Fi.
      return "No GPS fix. This needs a clear view of the sky and an https:// address.";
    case err.TIMEOUT:
      return "Timed out waiting for a GPS fix.";
    default:
      return err.message || "Location unavailable.";
  }
}
