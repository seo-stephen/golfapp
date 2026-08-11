"use client";

import { useState } from "react";
import { setCourseHoleGreens } from "@/lib/repo";
import { Button } from "@/components/ui";
import type { Course, LatLon } from "@/types";
import type { ImportedHole } from "@/lib/osm";

interface ImportResponse {
  holes?: ImportedHole[];
  attribution?: string;
  error?: string;
}

/**
 * Pulls per-hole green positions for a course from OpenStreetMap.
 *
 * Anchored on the course's own coordinates when it has them, otherwise on the
 * device's current position — which is the case when you're standing at the
 * course, and avoids having to geocode a club name.
 */
export function ImportGreensButton({ course }: { course: Course }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alreadySet = course.holes.filter((h) => h.green).length;

  async function anchorPoint(): Promise<LatLon> {
    if (course.location) return course.location;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error(
        "This course has no saved coordinates and this device can't provide a location."
      );
    }
    return new Promise<LatLon>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () =>
          reject(
            new Error(
              "This course has no saved coordinates, so importing needs your location — allow it and try again while you're at the course."
            )
          ),
        { enableHighAccuracy: false, timeout: 15_000 }
      );
    });
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { lat, lon } = await anchorPoint();
      const res = await fetch(`/api/osm/holes?lat=${lat}&lon=${lon}`);
      const data: ImportResponse = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");

      const holes = data.holes ?? [];
      if (holes.length === 0) {
        setStatus(
          "OpenStreetMap has no mapped holes here. You can still save each green by hand from the round screen."
        );
        return;
      }

      const applied = await setCourseHoleGreens(
        course.id,
        holes.map((h) => ({ number: h.number, green: h.green }))
      );
      setStatus(
        `Located ${applied} of 18 greens from OpenStreetMap${
          applied < 18 ? " — save the rest by hand as you play them." : "."
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button variant="secondary" onClick={handleImport} disabled={busy}>
        {busy ? "Looking up…" : alreadySet > 0 ? "Re-import GPS greens" : "Import GPS greens"}
      </Button>
      {alreadySet > 0 && !status && !error && (
        <p className="text-[11px] text-cream-500">{alreadySet}/18 greens located.</p>
      )}
      {status && <p className="text-[11px] text-kelly-400">{status}</p>}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {status && (
        <p className="text-[11px] text-cream-600">© OpenStreetMap contributors (ODbL)</p>
      )}
    </div>
  );
}
