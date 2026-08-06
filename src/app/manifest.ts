import type { MetadataRoute } from "next";

// Installing to the Home Screen matters beyond looks on iOS: WebKit evicts
// script-writable storage (including IndexedDB, where every round lives) after
// ~7 days without interaction for ordinary websites, while installed web apps
// are exempt. See the export/import in Settings for the belt-and-braces backup.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TripleBogey — Golf Trainer",
    short_name: "TripleBogey",
    description:
      "Track rounds, stats, handicap, and swing analysis for your golf game.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
