// Writes public/precache.json listing every build asset the service worker
// should cache at install.
//
// Why this exists: precaching the route documents alone is not enough. Each
// page's JS chunk is content-hashed, so the worker cannot know the filenames
// ahead of time — and without them a page that was never opened while online
// loads its HTML from cache and then fails on a missing chunk. That is how
// "Start a round" broke offline.

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const STATIC_DIR = join(process.cwd(), ".next", "static");
const OUT_FILE = join(process.cwd(), "public", "precache.json");

const CACHEABLE = new Set([".js", ".css", ".woff", ".woff2"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

if (!existsSync(STATIC_DIR)) {
  console.error(
    "gen-precache: .next/static not found — run this after `next build`."
  );
  process.exit(1);
}

const files = walk(STATIC_DIR)
  .filter((f) => CACHEABLE.has(f.slice(f.lastIndexOf("."))))
  .map((f) => "/_next/static/" + relative(STATIC_DIR, f).split(sep).join("/"))
  .sort();

mkdirSync(join(process.cwd(), "public"), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify({ assets: files }, null, 2) + "\n");

console.log(`gen-precache: wrote ${files.length} assets to public/precache.json`);
