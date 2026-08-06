import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { PoseFrame } from "@/types";

// Capture-side concerns only. The swing math lives in ./swingMetrics so it can
// be unit tested without pulling in TensorFlow or the DOM.
export { deriveMetrics, SKELETON_PAIRS } from "./swingMetrics";

let detectorPromise: Promise<poseDetection.PoseDetector> | null = null;

import { MOVENET_MODEL_URL } from "./modelAssets";

export { MOVENET_MODEL_URL };

export function loadDetector(): Promise<poseDetection.PoseDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      await tf.setBackend("webgl");
      await tf.ready();
      return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        modelUrl: MOVENET_MODEL_URL,
        enableSmoothing: true,
      });
    })().catch((err) => {
      // Don't cache a rejected promise, or every later attempt fails too.
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

// iOS Safari's MediaRecorder only produces MP4, and those blobs are fragmented —
// frame-accurate seeking on them is unreliable, and duration often reports as
// Infinity. So poses are captured live off the preview stream while recording,
// and the recorded clip is kept only for playback.
export function createLiveTracker() {
  const frames: PoseFrame[] = [];
  let running = false;
  let startTime = 0;
  let rafId: number | null = null;

  async function start(video: HTMLVideoElement) {
    if (running) return;
    const detector = await loadDetector();
    running = true;
    startTime = performance.now();

    const tick = async () => {
      if (!running) return;
      // A zero-sized frame means the stream hasn't produced video yet.
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const poses = await detector.estimatePoses(
            video,
            { maxPoses: 1, flipHorizontal: false },
            performance.now()
          );
          const pose = poses[0];
          // Re-check `running`: stop() may have landed while we were awaiting.
          if (pose && running) {
            frames.push({
              t: Math.round(performance.now() - startTime),
              keypoints: pose.keypoints
                .filter((k) => k.name)
                .map((k) => ({
                  name: k.name as string,
                  x: k.x,
                  y: k.y,
                  score: k.score,
                })),
            });
          }
        } catch {
          // A single dropped frame shouldn't end the capture.
        }
      }
      if (running) rafId = requestAnimationFrame(() => void tick());
    };

    rafId = requestAnimationFrame(() => void tick());
  }

  function stop() {
    running = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    return {
      frames,
      durationMs: frames.length ? frames[frames.length - 1].t : 0,
    };
  }

  return { start, stop, frameCount: () => frames.length };
}

// iOS Safari only records MP4; Chrome/Firefox prefer WebM. Probe in order and
// let the browser pick its default if none match.
export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}
