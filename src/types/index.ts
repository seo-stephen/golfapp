/** WGS84 coordinate pair, as reported by the Geolocation API and OSM. */
export interface LatLon {
  lat: number;
  lon: number;
}

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
  /**
   * Centre of the green, for on-course GPS distance. Absent until imported
   * from OpenStreetMap or captured by standing on the green.
   */
  green?: LatLon;
}

export interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  /** Clubhouse/property location, used to anchor the OSM hole-data lookup. */
  location?: LatLon;
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
  /** OB, water, lost ball, etc. — strokes already included in `strokes`. */
  penalties: number | null;
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

export type ShotResult = "green" | "short" | "long" | "left" | "right";

/** A single logged range/approach shot, for building a personal yardage book. */
export interface Shot {
  id: string;
  date: number;
  club: string;
  distanceYds: number;
  result: ShotResult | null;
  createdAt: number;
}

/** One logged putting-practice session at a single distance. */
export interface PuttingSession {
  id: string;
  date: number;
  distanceFt: number;
  attempts: number;
  makes: number;
  createdAt: number;
}
