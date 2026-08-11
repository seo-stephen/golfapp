"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface Ball {
  dx: number;
  dy: number;
  spinDeg: number;
  delayMs: number;
  sizePx: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  balls: Ball[];
}

const BALL_COUNT = 14;
const BURST_LIFETIME_MS = 900;

/**
 * Balls pop upward in a broad fan (not a full circle) then gravity — a fixed
 * downward offset added on top of each ball's own trajectory — pulls every
 * one of them back down by the end, regardless of which way it popped.
 */
function makeBalls(): Ball[] {
  return Array.from({ length: BALL_COUNT }, () => {
    const angleDeg = -90 + (Math.random() - 0.5) * 260;
    const angleRad = (angleDeg * Math.PI) / 180;
    const distance = 45 + Math.random() * 95;
    const gravity = 55 + Math.random() * 45;
    return {
      dx: Math.cos(angleRad) * distance,
      dy: Math.sin(angleRad) * distance + gravity,
      spinDeg: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 360),
      delayMs: Math.random() * 90,
      sizePx: 9 + Math.random() * 7,
    };
  });
}

let nextBurstId = 0;

type BurstFn = (origin: { x: number; y: number }) => void;

const GolfBallBurstContext = createContext<BurstFn | null>(null);

export function GolfBallBurstProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  // Lives in the root layout rather than the page that triggered it, so the
  // animation keeps playing over whatever page a click navigates to next —
  // most triggers here (Start a round, Finish round) fire right before a
  // route change.
  const burst = useCallback((origin: { x: number; y: number }) => {
    const id = nextBurstId++;
    setBursts((prev) => [...prev, { id, x: origin.x, y: origin.y, balls: makeBalls() }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, BURST_LIFETIME_MS);
  }, []);

  return (
    <GolfBallBurstContext.Provider value={burst}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
        {bursts.map((b) => (
          <div key={b.id} style={{ position: "absolute", left: b.x, top: b.y }}>
            {b.balls.map((ball, i) => (
              <span
                key={i}
                className="golf-ball-particle"
                style={
                  {
                    "--dx": `${ball.dx}px`,
                    "--dy": `${ball.dy}px`,
                    "--spin": `${ball.spinDeg}deg`,
                    animationDelay: `${ball.delayMs}ms`,
                    width: ball.sizePx,
                    height: ball.sizePx,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ))}
      </div>
    </GolfBallBurstContext.Provider>
  );
}

export function useGolfBallBurst(): BurstFn {
  const ctx = useContext(GolfBallBurstContext);
  if (!ctx) {
    throw new Error("useGolfBallBurst must be used within a GolfBallBurstProvider");
  }
  return ctx;
}

/** Origin = the center of whatever was clicked/tapped, so balls pop from the button itself. */
export function burstOriginFromEvent(e: { currentTarget: Element }): { x: number; y: number } {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
