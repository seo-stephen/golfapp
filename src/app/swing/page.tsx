"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { requireDb } from "@/lib/db";
import { saveSwingSession } from "@/lib/repo";
import {
  createLiveTracker,
  deriveMetrics,
  loadDetector,
  pickRecorderMimeType,
} from "@/lib/swing";
import { Button, Card } from "@/components/ui";

type Stage = "idle" | "ready" | "recording" | "saving" | "error";

function modelErrorMessage(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return `Couldn't load the pose model: ${detail}. It downloads once and is then cached — you may need a connection for the first swing.`;
}

export default function SwingPage() {
  const router = useRouter();
  const sessions = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return requireDb().swingSessions.orderBy("date").reverse().toArray();
  }, [], []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const trackerRef = useRef<ReturnType<typeof createLiveTracker> | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadingModel, setLoadingModel] = useState(true);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [liveFrames, setLiveFrames] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Warm the model up front so tapping record doesn't stall on the download.
  useEffect(() => {
    let cancelled = false;
    loadDetector()
      .then(() => {
        if (!cancelled) {
          setModelReady(true);
          setLoadingModel(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(modelErrorMessage(err));
          setStage("error");
          setLoadingModel(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function retryModel() {
    setLoadingModel(true);
    setError(null);
    try {
      await loadDetector();
      setModelReady(true);
      setStage("idle");
    } catch (err) {
      setError(modelErrorMessage(err));
      setStage("error");
    } finally {
      setLoadingModel(false);
    }
  }

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Navigating away mid-recording must tear everything down: the pose loop would
  // otherwise keep running against a detached video, and the recorder's onstop
  // would try to save a session and redirect from an unmounted page.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        try {
          recorder.stop();
        } catch {
          // Already torn down by the browser; nothing to do.
        }
      }
      recorderRef.current = null;
      trackerRef.current?.stop();
      trackerRef.current = null;
      stopStream();
    };
  }, [stopStream]);

  useEffect(() => {
    if (stage !== "recording") return;
    const id = setInterval(() => {
      setElapsed((e) => e + 0.1);
      setLiveFrames(trackerRef.current?.frameCount() ?? 0);
    }, 100);
    return () => clearInterval(id);
  }, [stage]);

  async function enableCamera(nextFacing: "environment" | "user" = facing) {
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        await video.play();
      }
      setFacing(nextFacing);
      setStage("ready");
      return stream;
    } catch (err) {
      setError(
        `Couldn't access the camera: ${err instanceof Error ? err.message : String(err)}. On iPhone, camera access needs Safari and an https or localhost page.`
      );
      setStage("error");
      return null;
    }
  }

  async function startRecording() {
    const stream = streamRef.current ?? (await enableCamera());
    const video = videoRef.current;
    if (!stream || !video) return;

    chunksRef.current = [];
    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      // Use the type the recorder actually negotiated — assuming webm here
      // would mislabel the MP4 that iOS Safari produces.
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "video/mp4",
      });
      const tracked = trackerRef.current?.stop() ?? { frames: [], durationMs: 0 };
      setStage("saving");
      try {
        if (tracked.frames.length < 5) {
          throw new Error(
            "Not enough body positions were detected. Make sure your full body is in frame, then record a slightly longer clip."
          );
        }
        const metrics = deriveMetrics(tracked.frames);
        const session = await saveSwingSession({
          date: Date.now(),
          videoBlob: blob,
          durationMs: tracked.durationMs,
          frames: tracked.frames,
          metrics,
        });
        stopStream();
        router.push(`/swing/session?id=${session.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStage("error");
      }
    };

    const tracker = createLiveTracker();
    trackerRef.current = tracker;
    await tracker.start(video);

    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setLiveFrames(0);
    setStage("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function reset() {
    setError(null);
    setStage(streamRef.current ? "ready" : "idle");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Swing analysis</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Prop your phone up side-on with your full body in frame. Pose tracking runs on
          your device — nothing is uploaded.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] sm:aspect-video">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="w-full h-full object-cover"
          />
          {stage === "idle" && (
            <div className="absolute inset-0 grid place-items-center text-sm text-neutral-400 px-6 text-center">
              {modelReady ? "Camera off" : "Loading pose model…"}
            </div>
          )}
          {stage === "recording" && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-2 text-xs bg-black/70 px-2.5 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {elapsed.toFixed(1)}s
              </div>
              <div className="absolute top-3 right-3 text-xs bg-black/70 px-2.5 py-1.5 rounded-full">
                {liveFrames} frames
              </div>
            </>
          )}
          {stage === "saving" && (
            <div className="absolute inset-0 bg-black/70 grid place-items-center text-sm">
              Analyzing swing…
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(stage === "idle" || stage === "error") &&
            (modelReady ? (
              <Button onClick={() => enableCamera()}>Enable camera</Button>
            ) : (
              // Never leave this permanently disabled: if the model download
              // failed there would be no way back without a reload.
              <Button onClick={retryModel} disabled={loadingModel}>
                {loadingModel ? "Loading model…" : "Retry loading model"}
              </Button>
            ))}
          {stage === "ready" && (
            <>
              <Button onClick={startRecording} className="flex-1 sm:flex-none">
                Start recording
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  enableCamera(facing === "environment" ? "user" : "environment")
                }
              >
                Flip camera
              </Button>
            </>
          )}
          {stage === "recording" && (
            <Button variant="danger" onClick={stopRecording} className="flex-1 sm:flex-none">
              Stop &amp; analyze
            </Button>
          )}
          {stage === "error" && (
            <Button variant="secondary" onClick={reset}>
              Dismiss
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <p className="text-xs text-neutral-500 border-t border-neutral-800 pt-3">
          Metrics are heuristic estimates from 2D body keypoints on a single camera view —
          useful for tracking trends in your own swing, not a substitute for professional
          biomechanical analysis or a coach.
        </p>
      </Card>

      <Card>
        <h2 className="font-medium mb-3">Past sessions</h2>
        <ul className="divide-y divide-neutral-800">
          {(sessions ?? []).map((s) => (
            <li key={s.id}>
              <Link
                href={`/swing/session?id=${s.id}`}
                className="flex items-center justify-between py-3 min-h-11 active:opacity-60"
              >
                <div>
                  <div className="font-medium text-sm">
                    {new Date(s.date).toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {(s.durationMs / 1000).toFixed(1)}s · {s.frames.length} frames
                  </div>
                </div>
                <div className="text-sm text-neutral-400">
                  {s.metrics.tempoRatio != null ? `${s.metrics.tempoRatio}:1` : "—"}
                </div>
              </Link>
            </li>
          ))}
          {(sessions ?? []).length === 0 && (
            <p className="text-sm text-neutral-500 py-3">No swing sessions yet.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
