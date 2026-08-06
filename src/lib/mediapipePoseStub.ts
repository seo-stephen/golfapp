// @tensorflow-models/pose-detection statically imports `Pose` from
// @mediapipe/pose for its BlazePose MediaPipe runtime, but that package ships a
// UMD global script with no ES exports, which breaks bundling. This app only
// uses the MoveNet runtime, so the import is aliased here (see next.config.ts)
// and the export is never actually constructed.
export class Pose {
  constructor() {
    throw new Error(
      "The BlazePose MediaPipe runtime is not bundled in this app — BogeyBoys uses MoveNet."
    );
  }
}
