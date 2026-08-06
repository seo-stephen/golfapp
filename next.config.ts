import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // @tensorflow-models/pose-detection statically imports @mediapipe/pose,
    // which ships a UMD global with no ES exports and fails to bundle. Only
    // MoveNet is used here, so that import is redirected to a stub.
    resolveAlias: {
      "@mediapipe/pose": "./src/lib/mediapipePoseStub.ts",
    },
  },
};

export default nextConfig;
