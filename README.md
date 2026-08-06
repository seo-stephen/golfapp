# BogeyBoys

A golf trainer web app: digital scorecard, round history, stats, WHS-style handicap
index, and in-browser webcam swing analysis.

Built with Next.js (App Router) + TypeScript + Tailwind. All data is stored locally
in the browser via IndexedDB (Dexie) — there is no backend database and nothing is
uploaded anywhere.

Built iPhone-first (tested at 402×874, iPhone 17 Pro): bottom tab bar, safe-area
padding for the Dynamic Island and home indicator, 44px touch targets, and a
one-hole-at-a-time scorecard instead of a wide table.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

### Using it on your iPhone

The swing camera needs a **secure context**. `http://localhost` qualifies, but
`http://192.168.x.x` does not — so opening the plain-HTTP dev server from your phone
over Wi-Fi will load the app but silently block the camera. Two ways around it:

```bash
npm run dev:phone
```

That runs `next dev --experimental-https -H 0.0.0.0`, generating a locally trusted
cert via mkcert. Open `https://<your-mac-ip>:3000` on the phone and accept the
certificate prompt once.

Alternatively deploy it (Vercel or any host with HTTPS) and use it from there — that
also makes it work away from your home network, which matters on a course.

Add it to your Home Screen from the Safari share sheet for a full-screen, app-like
window (`apple-mobile-web-app-capable` is set).

## Course data (optional API key)

Course search hits a server-side route (`src/app/api/courses/search/route.ts`) that
proxies [GolfCourseAPI.com](https://golfcourseapi.com). Without a key the app falls
back to a handful of bundled sample courses, so every flow works out of the box.

To use real course data, create `.env.local`:

```bash
echo 'GOLF_COURSE_API_KEY=your_key_here' >> .env.local
```

Restart the dev server after adding it. The key is read server-side only and is never
exposed to the browser.

Note: the API response mapping in that route was written against GolfCourseAPI's
documented shape but has not been verified against a live key. If real results come
back empty or mis-mapped, the field names in `mapApiCourses` are the place to adjust —
the route falls back to sample data rather than erroring.

## Features

- **Courses** (`/courses`) — search for courses or add one manually with per-hole pars,
  tee ratings, and slope.
- **Rounds** (`/round/new`, `/round/[id]`, `/rounds`) — start a round, enter strokes,
  putts, penalty strokes, fairways hit, and greens in regulation per hole. Totals, score
  relative to par, and blow-up holes (double bogey or worse) update live.
- **Stats** (`/stats`) — scoring average, blow-up hole %, fairway %, GIR %, putts per
  round, penalty strokes per round, and a handicap index trend chart.
- **Yardages** (`/yardages`) — log club, distance, and shot result from the range or an
  approach shot; builds a personal yardage book (avg/min/max distance per club) over
  time instead of guessing carry distances.
- **Swing analysis** (`/swing`) — record a swing with your camera; MoveNet pose
  detection runs locally to estimate swing tempo, spine tilt at address, and head sway,
  with a frame-by-frame skeleton scrubber.
- **Settings** (`/settings`) — export/import a JSON backup of your data.

## Back up your data

Everything lives in IndexedDB on the device. iOS Safari **deletes a site's storage after
about seven days without a visit**, which would take your rounds and handicap with it.
Two mitigations, both worth doing:

1. Add the app to your Home Screen from the Safari share sheet. Installed web apps are
   exempt from that cleanup, and a web manifest is shipped so it installs cleanly.
2. Export a backup from `/settings` now and then. Restoring is id-keyed, so re-importing
   the same file updates rather than duplicates. Swing *videos* are excluded from the
   backup (large, and the metrics are what matter); swing metrics are kept.

### Handicap calculation

`src/lib/handicap.ts` implements the World Handicap System calculation: a per-round
differential of `(113 / slope) × (score − course rating)`, then the lowest-N-of-last-20
averaging table for the index, capped at 54.0.

Two things worth knowing, both covered by tests in `src/lib/handicap.test.ts`:

- There is **no `× 0.96` multiplier**. That "bonus for excellence" belonged to the
  pre-2020 USGA system and was dropped by WHS; applying it reports every index ~4% low.
- WHS needs **54 holes (3 rounds)** before it issues an index, so the app shows a dash
  until then rather than inventing a number from one round.

A round only produces a differential when all 18 holes have a score. Summing a
part-played round would treat the unplayed holes as 0 strokes, yielding a hugely
negative differential that becomes the player's "best" round and drags the index down
for the next 20 rounds.

Not implemented: the net-double-bogey per-hole cap, Playing Conditions Calculation,
soft/hard caps, and 9-hole score combining — so this won't exactly match an official
index.

### How swing analysis works

Poses are detected **live off the camera preview while recording**, not by seeking the
saved clip afterwards. That's deliberate: iOS Safari's MediaRecorder only produces
fragmented MP4, whose duration often reports as `Infinity` and which doesn't seek
frame-accurately. The recorded video is kept purely for playback, and the pose scrubber
renders from the captured keypoints, so it works regardless of container quirks.

Analysis runs at the device's animation frame rate, so a faster phone samples the swing
more densely — an iPhone 17 Pro gives plenty of resolution for tempo (a downswing is
roughly 8 frames at 30fps).

Metrics come from 2D keypoints on a single camera view. They're meaningful for
comparing your own swings over time, not as absolute biomechanical measurements.
Record from the side, full body in frame, good lighting.

## Notes

- `next.config.ts` aliases `@mediapipe/pose` to a stub. The pose-detection package
  imports it statically for its BlazePose runtime, but it ships as a UMD global with no
  ES exports and breaks bundling. This app only uses MoveNet, so the stub is never
  constructed.
- The MoveNet weights are fetched from `tfhub.dev` on first use and then live in the
  browser's HTTP cache. The first swing recording therefore needs a connection; to make
  the feature reliable with no signal on a course, self-host the model files and point
  `loadDetector` at them via MoveNet's `modelUrl` option.

## Offline

The app works with no signal — verified by killing the server outright and then cold
loading, starting a new round, opening a round never visited while online, entering
scores, and reading stats.

Three pieces make that work:

1. **Every page route is static.** A single round lives at `/round?id=<uuid>`, not
   `/round/[id]`. A dynamic segment forces Next to render each id on the server (the
   response is even sent `Cache-Control: no-store`), so a round could never be opened
   without a connection. As a query parameter there is one prerendered `round.html` that
   serves every round; the id is read on the client and looked up in IndexedDB. Same for
   `/swing/session?id=`.
2. **`public/sw.js`** precaches those route documents plus every hashed build asset, and
   keys page and RSC cache entries by *pathname only* — otherwise each round id would be
   a separate cache miss.
3. **`scripts/gen-precache.mjs`** runs as part of `npm run build` and writes
   `public/precache.json` listing every hashed chunk. Without it, a page whose document
   is cached still dies offline on a missing chunk — that is exactly how "Start a round"
   broke the first time.

4. **A 2.5s network timeout** on page and RSC requests. On a course the signal is usually
   weak rather than absent, which is the worse case: `fetch` doesn't reject, it hangs, so
   a plain network-first stalls the page while a good cached copy sits unused. Measured
   against a proxy that delays every response by 10s, a navigation completes in **2.5s**
   instead of 10s. When the timeout wins, the request is left running so it still
   refreshes the cache.

The MoveNet model is self-hosted under `public/models/` (4.6MB) rather than fetched from
tfhub.dev, and is cached on first use rather than at install so a user who never opens
swing analysis doesn't pay for it. Because that means a *first* swing needs a connection,
Settings shows whether the model is cached and offers a "Download for offline use"
button — verified by downloading it, killing the server, and cold-loading `/swing`, which
comes up ready to record.

Only course search needs the network, and it says so instead of showing "no results".

**Deployment caveat, unverified:** `public/precache.json` is written during `npm run
build`, so it should be captured by any host that snapshots the build output (Vercel
included) — but that hasn't been tested on a real deploy. If it's missing, the worker
degrades rather than breaks: it still precaches the route documents and caches assets as
you visit pages, so only never-visited routes would fail offline. After the first deploy,
check that `https://<your-host>/precache.json` returns JSON.

**Testing offline:** `npm run build && npx next start`, load the app once, then stop the
server entirely and reload. Stopping the server is a stricter test than Safari's offline
toggle, since requests genuinely fail rather than being short-circuited. Note that
`navigator.onLine` stays `true` in this state — it reports the OS network interface, not
whether anything is actually reachable, which is why nothing in the app branches on it.

To test the *weak signal* case rather than the offline one, put a proxy in front that
delays responses instead of refusing them; that is the case the 2.5s timeout exists for,
and an offline toggle will not exercise it.

## Known gaps

- Swing recording has **not been verified end to end on a real device** — the pose math,
  metrics, and UI are unit-tested and the model loads, but the camera capture path needs
  a real swing on a real iPhone.
- The GolfCourseAPI response mapping has never run against a live key.
- The service worker is hand-written rather than Serwist. `next-pwa` is abandoned and
  `@serwist/next` is webpack-only, so it wouldn't work with Turbopack anyway; the
  Turbopack package exists but its Next 16.3 compatibility isn't proven. Revisit if the
  caching rules grow.

## Scripts

```bash
npm test
```

```bash
npm run build
```

```bash
npm run lint
```
