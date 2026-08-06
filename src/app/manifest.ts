import type { MetadataRoute } from "next";

// Installing to the Home Screen matters beyond looks on iOS: WebKit evicts
// script-writable storage (including IndexedDB, where every round lives) after
// ~7 days without interaction for ordinary websites, while installed web apps
// are exempt. See the export/import in Settings for the belt-and-braces backup.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BogeyBoys — Golf Trainer",
    short_name: "BogeyBoys",
    description:
      "Track rounds, stats, handicap, and swing analysis for your golf game.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d2318",
    theme_color: "#0d2318",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
