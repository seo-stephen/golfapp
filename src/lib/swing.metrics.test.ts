import { describe, expect, it } from "vitest";
import { deriveMetrics, keypointBounds } from "./swingMetrics";
import type { PoseFrame } from "@/types";

// Side-on view, image coordinates: y grows downward, so a SMALLER y means the
// hands are higher. x grows to the right.
function frame(t: number, wristY: number, opts: { noseX?: number } = {}): PoseFrame {
  const noseX = opts.noseX ?? 100;
  return {
    t,
    keypoints: [
      { name: "nose", x: noseX, y: 60, score: 0.9 },
      { name: "left_shoulder", x: 100, y: 150, score: 0.9 },
      { name: "right_shoulder", x: 120, y: 150, score: 0.9 },
      { name: "left_hip", x: 105, y: 280, score: 0.9 },
      { name: "right_hip", x: 125, y: 280, score: 0.9 },
      { name: "left_wrist", x: 110, y: wristY, score: 0.9 },
      { name: "right_wrist", x: 112, y: wristY, score: 0.9 },
      { name: "left_knee", x: 105, y: 400, score: 0.9 },
      { name: "right_knee", x: 125, y: 400, score: 0.9 },
      { name: "left_ankle", x: 105, y: 500, score: 0.9 },
      { name: "right_ankle", x: 125, y: 500, score: 0.9 },
    ],
  };
}

/**
 * Builds a swing at 30fps (33ms/frame) through four phases, with hand height
 * interpolated linearly between the given waypoints.
 */
function buildSwing(opts: {
  addressMs: number;
  addressY: number;
  topMs: number;
  topY: number;
  impactMs: number;
  impactY: number;
  finishMs: number;
  finishY: number;
  noseXAt?: (t: number) => number;
}): PoseFrame[] {
  const stops = [
    { t: 0, y: opts.addressY },
    { t: opts.addressMs, y: opts.addressY },
    { t: opts.topMs, y: opts.topY },
    { t: opts.impactMs, y: opts.impactY },
    { t: opts.finishMs, y: opts.finishY },
  ];
  const frames: PoseFrame[] = [];
  for (let t = 0; t <= opts.finishMs; t += 33) {
    let y = stops[stops.length - 1].y;
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i].t) {
        const a = stops[i - 1];
        const b = stops[i];
        const span = b.t - a.t || 1;
        y = a.y + ((t - a.t) / span) * (b.y - a.y);
        break;
      }
    }
    frames.push(frame(t, y, { noseX: opts.noseXAt?.(t) }));
  }
  return frames;
}

describe("deriveMetrics", () => {
  it("returns all-null when there are too few frames", () => {
    const m = deriveMetrics([frame(0, 400), frame(33, 390)]);
    expect(m.tempoRatio).toBeNull();
    expect(m.backswingMs).toBeNull();
    expect(m.topFrameIndex).toBeNull();
  });

  it("returns all-null when keypoint confidence is too low to use", () => {
    const lowConfidence: PoseFrame[] = Array.from({ length: 20 }, (_, i) => ({
      t: i * 33,
      keypoints: [
        { name: "left_wrist", x: 110, y: 300, score: 0.05 },
        { name: "right_wrist", x: 112, y: 300, score: 0.05 },
      ],
    }));
    expect(deriveMetrics(lowConfidence).tempoRatio).toBeNull();
  });

  it("finds address, top and impact on a clean swing", () => {
    // Hands: address y=400, top y=150, impact y=400, finish y=380 (finish
    // deliberately LOWER than the top here).
    const frames = buildSwing({
      addressMs: 300,
      addressY: 400,
      topMs: 1000,
      topY: 150,
      impactMs: 1250,
      impactY: 400,
      finishMs: 1600,
      finishY: 380,
    });
    const m = deriveMetrics(frames);

    expect(m.addressFrameIndex).not.toBeNull();
    expect(m.topFrameIndex).not.toBeNull();
    expect(m.impactFrameIndex).not.toBeNull();

    // The detected top should sit near the real top (1000ms), not elsewhere.
    expect(frames[m.topFrameIndex as number].t).toBeGreaterThan(900);
    expect(frames[m.topFrameIndex as number].t).toBeLessThan(1100);

    // Backswing ≈ 700ms, downswing ≈ 250ms, so tempo ≈ 3:1.
    expect(m.backswingMs as number).toBeGreaterThan(550);
    expect(m.downswingMs as number).toBeGreaterThan(150);
    expect(m.tempoRatio as number).toBeGreaterThan(2);
    expect(m.tempoRatio as number).toBeLessThan(4.5);
  });

  it("still finds the top of the BACKSWING when the finish is higher (real swings)", () => {
    // In a real golf swing the hands finish HIGHER than the top of the
    // backswing. A naive global-minimum search would mistake the finish for the
    // top, inflating the backswing and destroying the tempo ratio.
    const frames = buildSwing({
      addressMs: 300,
      addressY: 400,
      topMs: 1000,
      topY: 150,
      impactMs: 1250,
      impactY: 400,
      finishMs: 1700,
      finishY: 80, // higher (smaller y) than the top of the backswing
    });
    const m = deriveMetrics(frames);

    const topT = frames[m.topFrameIndex as number].t;
    expect(topT).toBeGreaterThan(880);
    expect(topT).toBeLessThan(1120);

    // Impact must land after the top and near 1250ms, not out in the finish.
    const impactT = frames[m.impactFrameIndex as number].t;
    expect(impactT).toBeGreaterThan(topT);
    expect(impactT).toBeLessThan(1450);

    // Tempo should stay in a plausible golf range rather than blowing up.
    expect(m.tempoRatio as number).toBeGreaterThan(1.5);
    expect(m.tempoRatio as number).toBeLessThan(5);
  });

  it("reports spine tilt as the hip→shoulder angle off vertical", () => {
    const frames = buildSwing({
      addressMs: 300,
      addressY: 400,
      topMs: 1000,
      topY: 150,
      impactMs: 1250,
      impactY: 400,
      finishMs: 1600,
      finishY: 380,
    });
    const m = deriveMetrics(frames);
    // Shoulders midpoint x=110, hips midpoint x=115 -> dx=-5, dy=130.
    // atan(5/130) ≈ 2.2°
    expect(m.spineTiltDeg).toBeCloseTo(2.2, 1);
  });

  it("measures head sway as horizontal nose travel from address to impact", () => {
    const frames = buildSwing({
      addressMs: 300,
      addressY: 400,
      topMs: 1000,
      topY: 150,
      impactMs: 1250,
      impactY: 400,
      finishMs: 1600,
      finishY: 380,
      // Nose slides 20px right between address (300ms) and impact (1250ms).
      noseXAt: (t) => 100 + (Math.min(Math.max(t - 300, 0), 950) / 950) * 20,
    });
    const m = deriveMetrics(frames);
    expect(m.headSwayPx as number).toBeGreaterThan(10);
    expect(m.headSwayPx as number).toBeLessThanOrEqual(20);
  });

  it("reports no sway when the head stays still", () => {
    const frames = buildSwing({
      addressMs: 300,
      addressY: 400,
      topMs: 1000,
      topY: 150,
      impactMs: 1250,
      impactY: 400,
      finishMs: 1600,
      finishY: 380,
    });
    expect(deriveMetrics(frames).headSwayPx).toBe(0);
  });

  it("derives timing from frame timestamps, not frame counts", () => {
    // Same swing shape, but the capture dropped frames so spacing is uneven.
    const dense = buildSwing({
      addressMs: 300,
      addressY: 400,
      topMs: 1000,
      topY: 150,
      impactMs: 1250,
      impactY: 400,
      finishMs: 1600,
      finishY: 380,
    });
    const sparse = dense.filter((_, i) => i % 2 === 0);
    const a = deriveMetrics(dense);
    const b = deriveMetrics(sparse);
    // Timestamps drive the math, so halving the sample rate should barely move
    // the measured durations.
    expect(Math.abs((a.backswingMs as number) - (b.backswingMs as number))).toBeLessThan(80);
  });
});

describe("keypointBounds", () => {
  it("tightly wraps the detected keypoints rather than anchoring at the origin", () => {
    // A person standing off to the right of a wide frame.
    const frames: PoseFrame[] = [
      {
        t: 0,
        keypoints: [
          { name: "nose", x: 600, y: 100, score: 0.9 },
          { name: "left_ankle", x: 640, y: 700, score: 0.9 },
        ],
      },
    ];
    const b = keypointBounds(frames);
    // Must not start at 0,0 — that is what left the skeleton small and off-centre.
    expect(b.x).toBeGreaterThan(400);
    expect(b.y).toBeGreaterThan(0);
    // And must contain every point.
    expect(b.x).toBeLessThan(600);
    expect(b.x + b.width).toBeGreaterThan(640);
    expect(b.y + b.height).toBeGreaterThan(700);
  });

  it("spans every frame so the skeleton doesn't jitter while scrubbing", () => {
    const frames: PoseFrame[] = [
      { t: 0, keypoints: [{ name: "left_wrist", x: 100, y: 400, score: 0.9 }] },
      { t: 33, keypoints: [{ name: "left_wrist", x: 100, y: 100, score: 0.9 }] },
    ];
    const b = keypointBounds(frames);
    expect(b.y).toBeLessThan(100);
    expect(b.y + b.height).toBeGreaterThan(400);
  });

  it("ignores low-confidence keypoints", () => {
    const frames: PoseFrame[] = [
      {
        t: 0,
        keypoints: [
          { name: "nose", x: 500, y: 500, score: 0.9 },
          { name: "left_ankle", x: 5000, y: 5000, score: 0.01 },
        ],
      },
    ];
    const b = keypointBounds(frames);
    expect(b.x + b.width).toBeLessThan(1000);
  });

  it("returns a safe unit box when nothing was detected", () => {
    expect(keypointBounds([])).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});
