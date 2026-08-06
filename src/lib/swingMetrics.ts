import type { PoseFrame, PoseKeypoint, SwingMetrics } from "@/types";

// Pure swing math, deliberately free of any TensorFlow or DOM imports so it can
// be unit tested in Node and reasoned about independently of capture.

const MIN_KEYPOINT_SCORE = 0.3;

function kp(frame: PoseFrame, name: string): PoseKeypoint | undefined {
  const found = frame.keypoints.find((k) => k.name === name);
  return found && (found.score ?? 1) > MIN_KEYPOINT_SCORE ? found : undefined;
}

function midpoint(a?: PoseKeypoint, b?: PoseKeypoint) {
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return a ?? b ?? undefined;
}

/** Mean hand height in image space (smaller y = hands higher). */
function wristHeight(frame: PoseFrame): number | null {
  const mid = midpoint(kp(frame, "left_wrist"), kp(frame, "right_wrist"));
  return mid ? mid.y : null;
}

/**
 * Shoulder-midpoint to hip-midpoint distance, used as a per-player scale so
 * pixel measurements can be normalized across different camera distances.
 */
function torsoHeight(frame: PoseFrame): number | null {
  const shoulders = midpoint(kp(frame, "left_shoulder"), kp(frame, "right_shoulder"));
  const hips = midpoint(kp(frame, "left_hip"), kp(frame, "right_hip"));
  if (!shoulders || !hips) return null;
  return Math.hypot(hips.x - shoulders.x, hips.y - shoulders.y);
}

const EMPTY_METRICS: SwingMetrics = {
  tempoRatio: null,
  backswingMs: null,
  downswingMs: null,
  spineTiltDeg: null,
  headSwayPx: null,
  headSwayPctShoulders: null,
  addressFrameIndex: null,
  topFrameIndex: null,
  impactFrameIndex: null,
};

export function deriveMetrics(frames: PoseFrame[]): SwingMetrics {
  if (frames.length < 5) return EMPTY_METRICS;

  const heights = frames.map(wristHeight);
  if (heights.filter((h): h is number => h != null).length < 5) return EMPTY_METRICS;

  // ---- Address: lowest hands (largest y) in the opening third, i.e. setup
  // before the takeaway.
  const searchEnd = Math.max(2, Math.floor(frames.length / 3));
  let addressIdx = -1;
  let addressY = -Infinity;
  for (let i = 0; i < searchEnd; i++) {
    const h = heights[i];
    if (h != null && h > addressY) {
      addressY = h;
      addressIdx = i;
    }
  }
  // The opening third may contain no usable wrist detection at all (the golfer
  // walks into frame late). Fall back to the first frame that does, rather than
  // leaving addressY at -Infinity and poisoning every threshold below it.
  if (addressIdx === -1) {
    const firstValid = heights.findIndex((h) => h != null);
    if (firstValid === -1) return EMPTY_METRICS;
    addressIdx = firstValid;
    addressY = heights[firstValid] as number;
  }

  // ---- Impact: the hands pass back down through address height. This is found
  // BEFORE the top on purpose. A real swing finishes with the hands higher than
  // the top of the backswing, so a global minimum over the whole clip would
  // pick the finish position instead of the top. Bounding the top search by
  // impact keeps it inside the backswing.
  const RETURN_FRACTION = 0.85;

  // Track how high the hands have climbed so far, scanning only until they
  // first come back down through address level.
  let provisionalTopY = Infinity;
  let impactIdx: number | null = null;

  for (let i = addressIdx + 1; i < frames.length; i++) {
    const h = heights[i];
    if (h == null) continue;
    if (h < provisionalTopY) {
      provisionalTopY = h;
      continue;
    }
    // Rising back toward address height after having gone up at least a little.
    const climbed = addressY - provisionalTopY;
    if (climbed > 0) {
      const threshold = provisionalTopY + climbed * RETURN_FRACTION;
      if (h >= threshold) {
        impactIdx = i;
        break;
      }
    }
  }

  // ---- Top of backswing: highest hands between address and impact. When no
  // impact was detected, fall back to the provisional top over the whole clip.
  const topSearchEnd = impactIdx ?? frames.length;
  let topIdx = addressIdx;
  let topY = Infinity;
  for (let i = addressIdx; i < topSearchEnd; i++) {
    const h = heights[i];
    if (h != null && h < topY) {
      topY = h;
      topIdx = i;
    }
  }

  const backswingMs = topIdx > addressIdx ? frames[topIdx].t - frames[addressIdx].t : null;
  const downswingMs =
    impactIdx != null && impactIdx > topIdx ? frames[impactIdx].t - frames[topIdx].t : null;
  const tempoRatio =
    backswingMs != null && downswingMs != null && downswingMs > 0
      ? Math.round((backswingMs / downswingMs) * 10) / 10
      : null;

  // ---- Spine tilt at address: hip→shoulder line measured off vertical.
  const addressFrame = frames[addressIdx];
  const shoulders = midpoint(
    kp(addressFrame, "left_shoulder"),
    kp(addressFrame, "right_shoulder")
  );
  const hips = midpoint(kp(addressFrame, "left_hip"), kp(addressFrame, "right_hip"));
  let spineTiltDeg: number | null = null;
  if (shoulders && hips) {
    const dx = shoulders.x - hips.x;
    const dy = hips.y - shoulders.y; // positive when shoulders sit above hips
    spineTiltDeg = Math.round(Math.abs((Math.atan2(dx, dy) * 180) / Math.PI) * 10) / 10;
  }

  // ---- Head sway: horizontal nose travel from address to impact.
  let headSwayPx: number | null = null;
  let headSwayPctShoulders: number | null = null;
  const noseAddress = kp(addressFrame, "nose");
  const noseImpact = impactIdx != null ? kp(frames[impactIdx], "nose") : undefined;
  if (noseAddress && noseImpact) {
    const swayPx = Math.abs(noseImpact.x - noseAddress.x);
    headSwayPx = Math.round(swayPx * 10) / 10;

    // Raw pixels aren't comparable between sessions — standing closer to the
    // camera inflates them. Express sway against the player's own torso height,
    // which scales identically with distance. Torso height (not shoulder width)
    // because from a side-on view the shoulders align along the camera axis and
    // their apparent width collapses.
    const torso = torsoHeight(addressFrame);
    if (torso != null && torso > 0) {
      headSwayPctShoulders = Math.round((swayPx / torso) * 1000) / 10;
    }
  }

  return {
    tempoRatio,
    backswingMs,
    downswingMs,
    spineTiltDeg,
    headSwayPx,
    headSwayPctShoulders,
    addressFrameIndex: addressIdx,
    topFrameIndex: topIdx,
    impactFrameIndex: impactIdx,
  };
}

/**
 * A single bounding box around every detected keypoint across all frames, with
 * a margin. Used as the pose scrubber's viewBox: anchoring at 0,0 instead would
 * leave the skeleton small and off to one side, since keypoints live in the
 * capture stream's full pixel space. One box for the whole clip (rather than
 * per-frame) keeps the skeleton from jittering as you scrub.
 */
export function keypointBounds(
  frames: PoseFrame[],
  marginFraction = 0.12
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const f of frames) {
    for (const k of f.keypoints) {
      if ((k.score ?? 1) <= MIN_KEYPOINT_SCORE) continue;
      if (k.x < minX) minX = k.x;
      if (k.x > maxX) maxX = k.x;
      if (k.y < minY) minY = k.y;
      if (k.y > maxY) maxY = k.y;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const rawW = Math.max(maxX - minX, 1);
  const rawH = Math.max(maxY - minY, 1);
  const margin = Math.max(rawW, rawH) * marginFraction;

  return {
    x: minX - margin,
    y: minY - margin,
    width: rawW + margin * 2,
    height: rawH + margin * 2,
  };
}

export const SKELETON_PAIRS: [string, string][] = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];
