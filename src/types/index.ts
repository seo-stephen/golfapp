export interface Tee {
  name: string;
  rating: number;
  slope: number;
  yardage?: number;
}

export interface CourseHole {
  number: number; // 1-18
  par: number;
  yardage?: number;
  handicapIndex?: number; // stroke index 1-18, 1 = hardest
}

export interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  source: "api" | "manual";
  externalId?: string;
  tees: Tee[];
  holes: CourseHole[]; // length 18
  /** True when hole pars are placeholders because upstream had no hole data. */
  parsAreEstimated?: boolean;
  createdAt: number;
}

export interface HoleScore {
  number: number;
  par: number;
  strokes: number | null;
  putts: number | null;
  fairwayHit: boolean | null; // null = n/a (par 3) or not recorded
  gir: boolean | null;
}

export interface Round {
  id: string;
  courseId: string;
  courseName: string;
  teeName: string;
  courseRating: number;
  slopeRating: number;
  date: number; // epoch ms
  holeScores: HoleScore[];
  completed: boolean;
  differential: number | null;
  createdAt: number;
}

export interface PoseKeypoint {
  name: string;
  x: number;
  y: number;
  score?: number;
}

export interface PoseFrame {
  t: number; // ms offset from clip start
  keypoints: PoseKeypoint[];
}

export interface SwingMetrics {
  tempoRatio: number | null;
  backswingMs: number | null;
  downswingMs: number | null;
  spineTiltDeg: number | null;
  /** Raw pixel sway — only comparable within a single session. */
  headSwayPx: number | null;
  /** Sway as a percentage of torso height, comparable across sessions. */
  headSwayPctShoulders: number | null;
  addressFrameIndex: number | null;
  topFrameIndex: number | null;
  impactFrameIndex: number | null;
}

export interface SwingSession {
  id: string;
  date: number;
  videoBlob: Blob;
  durationMs: number;
  frames: PoseFrame[];
  metrics: SwingMetrics;
  notes?: string;
  createdAt: number;
}
