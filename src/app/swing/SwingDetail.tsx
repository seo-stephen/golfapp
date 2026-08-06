"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { deleteSwingSession } from "@/lib/repo";
// From swingMetrics, not swing — keeps TensorFlow out of this page's bundle.
import { SKELETON_PAIRS, keypointBounds } from "@/lib/swingMetrics";
import { Button, Card, StatTile } from "@/components/ui";
import type { PoseFrame } from "@/types";

export default function SwingDetail({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  // Map a missing session to null so it is distinguishable from the undefined
  // that useLiveQuery returns while loading.
  const session = useLiveQuery(async () => {
    if (typeof window === "undefined") return undefined;
    return (await requireDb().swingSessions.get(sessionId)) ?? null;
  }, [sessionId]);

  const [frameIdx, setFrameIdx] = useState(0);

  const videoBlob = session?.videoBlob;
  const videoUrl = useMemo(
    () => (videoBlob ? URL.createObjectURL(videoBlob) : null),
    [videoBlob]
  );
  useEffect(() => {
    if (!videoUrl) return;
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const frames = useMemo(() => session?.frames ?? [], [session?.frames]);

  // Tight bounding box over the whole clip, so the skeleton fills the panel
  // instead of floating in a corner of the source frame's coordinate space.
  const bounds = useMemo(() => keypointBounds(frames), [frames]);

  if (session === undefined) return <p className="text-cream-400">Loading…</p>;
  if (session === null) return <p className="text-cream-400">Session not found.</p>;

  const m = session.metrics;
  const currentFrame = frames[Math.min(frameIdx, frames.length - 1)];

  async function handleDelete() {
    if (!confirm("Delete this swing session?")) return;
    await deleteSwingSession(sessionId);
    router.push("/swing");
  }

  const phaseLabel =
    frameIdx === m.addressFrameIndex
      ? "Address"
      : frameIdx === m.topFrameIndex
        ? "Top of backswing"
        : frameIdx === m.impactFrameIndex
          ? "Impact"
          : null;

  function jumpTo(idx: number | null) {
    if (idx != null) setFrameIdx(idx);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Swing session</h1>
        <p className="text-cream-400 text-sm mt-1">
          {new Date(session.date).toLocaleString()} ·{" "}
          {(session.durationMs / 1000).toFixed(1)}s · {frames.length} frames
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile
          label="Tempo ratio"
          value={m.tempoRatio != null ? `${m.tempoRatio}:1` : "—"}
          sub="back : down (tour ≈ 3:1)"
        />
        <StatTile
          label="Backswing"
          value={m.backswingMs != null ? `${m.backswingMs}ms` : "—"}
        />
        <StatTile
          label="Downswing"
          value={m.downswingMs != null ? `${m.downswingMs}ms` : "—"}
        />
        <StatTile
          label="Spine tilt"
          value={m.spineTiltDeg != null ? `${m.spineTiltDeg}°` : "—"}
          sub="at address, off vertical"
        />
        <StatTile
          label="Head sway"
          value={
            m.headSwayPctShoulders != null
              ? `${m.headSwayPctShoulders}%`
              : m.headSwayPx != null
                ? `${m.headSwayPx}px`
                : "—"
          }
          sub={
            m.headSwayPctShoulders != null
              ? "of torso height, address → impact"
              : "address → impact"
          }
        />
      </div>

      <Card className="space-y-3">
        <h2 className="font-medium">Recording</h2>
        {videoUrl && (
          <video
            src={videoUrl}
            controls
            playsInline
            muted
            className="w-full rounded-xl bg-black max-h-[60vh]"
          />
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-medium">Pose scrubber</h2>
          {phaseLabel && (
            <span className="text-xs px-2 py-1 rounded bg-kelly-500/20 text-kelly-300">
              {phaseLabel}
            </span>
          )}
        </div>

        <div className="bg-black rounded-xl overflow-hidden">
          {currentFrame ? (
            <svg
              viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
              className="w-full max-h-[55vh]"
              preserveAspectRatio="xMidYMid meet"
            >
              <PoseOverlay frame={currentFrame} scale={bounds.height} />
            </svg>
          ) : (
            <div className="aspect-[3/4] grid place-items-center text-sm text-cream-500">
              No pose frames captured.
            </div>
          )}
        </div>

        {frames.length > 0 && (
          <>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={frameIdx}
              onChange={(e) => setFrameIdx(parseInt(e.target.value, 10))}
              className="w-full h-11 accent-kelly-500"
              aria-label="Swing frame"
            />
            <div className="flex justify-between text-xs text-cream-500">
              <span>
                frame {frameIdx + 1} / {frames.length}
              </span>
              <span>{((currentFrame?.t ?? 0) / 1000).toFixed(2)}s</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {m.addressFrameIndex != null && (
                <Button variant="secondary" onClick={() => jumpTo(m.addressFrameIndex)}>
                  Address
                </Button>
              )}
              {m.topFrameIndex != null && (
                <Button variant="secondary" onClick={() => jumpTo(m.topFrameIndex)}>
                  Top
                </Button>
              )}
              {m.impactFrameIndex != null && (
                <Button variant="secondary" onClick={() => jumpTo(m.impactFrameIndex)}>
                  Impact
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      <Button variant="danger" onClick={handleDelete} className="w-full sm:w-auto">
        Delete session
      </Button>

      <p className="text-xs text-cream-500">
        Heuristic estimates from 2D keypoints on a single camera view — best for comparing
        your own swings over time rather than as absolute measurements.
      </p>
    </div>
  );
}

function PoseOverlay({ frame, scale }: { frame: PoseFrame; scale: number }) {
  const byName = new Map(frame.keypoints.map((k) => [k.name, k]));
  const visible = (name: string) => {
    const k = byName.get(name);
    return k && (k.score ?? 1) > 0.3 ? k : undefined;
  };
  // Sizes are in viewBox units, which now vary with how tightly the clip is
  // cropped — derive them from the box so the skeleton looks the same either way.
  const jointRadius = Math.max(scale * 0.012, 0.5);

  return (
    <>
      {SKELETON_PAIRS.map(([a, b]) => {
        const ka = visible(a);
        const kb = visible(b);
        if (!ka || !kb) return null;
        return (
          <line
            key={`${a}-${b}`}
            x1={ka.x}
            y1={ka.y}
            x2={kb.x}
            y2={kb.y}
            stroke="#3987e5"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {frame.keypoints.map((k) =>
        (k.score ?? 1) > 0.3 ? (
          <circle
            key={k.name}
            cx={k.x}
            cy={k.y}
            r={jointRadius}
            fill="#1baf7a"
            stroke="#0d0d0d"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null
      )}
    </>
  );
}
