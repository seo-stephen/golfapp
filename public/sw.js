/* TripleBogey service worker.
 *
 * Goal: a golfer on hole 7 with no signal can cold-start the app and keep
 * scoring. Everything the app needs is already in IndexedDB; the only thing
 * missing offline is the app shell itself, which is what this caches.
 *
 * Why the URL normalization below matters: a single round lives at
 * /round?id=<uuid>. Every round shares one static document, so cache entries
 * are keyed by pathname with the query string stripped — otherwise each round
 * would be a separate cache miss and only previously-opened rounds would work.
 */

const VERSION = "v1";
const SHELL_CACHE = `triplebogey-shell-${VERSION}`;
const ASSET_CACHE = `triplebogey-assets-${VERSION}`;
const MODEL_CACHE = `triplebogey-model-${VERSION}`;

// Every page route. All are statically prerendered, so each is one document
// that works for any id passed in the query string.
const SHELL_ROUTES = [
  "/",
  "/rounds",
  "/round",
  "/round/new",
  "/stats",
  "/swing",
  "/swing/session",
  "/courses",
  "/weather",
  "/settings",
];

const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, MODEL_CACHE];

/** Cache key for a page: pathname only, so ?id=… variants share one entry. */
function shellKey(url) {
  return new URL(url).pathname;
}

function isRscRequest(url) {
  return new URL(url).searchParams.has("_rsc");
}

/** Cache key for an RSC payload, likewise keyed by pathname alone. */
function rscKey(url) {
  return `/__rsc${new URL(url).pathname}`;
}

/** Fetch and cache one URL, tolerating individual failures. */
async function precacheOne(cache, url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (res.ok) await cache.put(url, res);
  } catch {
    /* Offline at install time; runtime caching will fill this in later. */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await Promise.all(SHELL_ROUTES.map((route) => precacheOne(shell, route)));

      // Every hashed JS/CSS/font chunk, from a manifest written at build time
      // by scripts/gen-precache.mjs. Without these, a route whose document is
      // cached still fails offline because its chunk was never fetched.
      try {
        const res = await fetch("/precache.json", { cache: "reload" });
        if (res.ok) {
          const { assets } = await res.json();
          const assetCache = await caches.open(ASSET_CACHE);
          await Promise.all(
            (assets ?? []).map((url) => precacheOne(assetCache, url))
          );
        }
      } catch {
        /* No manifest (e.g. dev): runtime caching still covers visited pages. */
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("triplebogey-") && !CURRENT_CACHES.includes(n))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

/** Immutable, content-hashed, or large-and-static: serve from cache first. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/* On a course the connection is usually weak rather than absent, and that is
 * the worse case: fetch() does not reject, it just hangs, so a plain
 * network-first stalls the page for however long the radio keeps trying while
 * a perfectly good cached copy sits unused. Cap the wait instead. */
const NETWORK_TIMEOUT_MS = 2500;

/**
 * Fresh when the network is healthy, cached copy when it is slow or down.
 *
 * If the timeout wins we serve the cache but deliberately let the request run
 * on to refresh the entry for next time. If there is nothing cached, waiting is
 * still better than failing, so we keep waiting.
 */
async function networkFirst(request, cacheName, key) {
  const cache = await caches.open(cacheName);

  const network = fetch(request).then((res) => {
    // Clone before anything else can consume the body.
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  // The page may never read this copy; don't let that surface as an unhandled
  // rejection when the request eventually fails.
  network.catch(() => {});

  const timedOut = Symbol("timeout");
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timedOut), NETWORK_TIMEOUT_MS);
  });

  try {
    const winner = await Promise.race([network, deadline]);
    if (winner !== timedOut) return winner;

    const hit = await cache.match(key);
    if (hit) return hit;

    // Nothing cached — the slow network is the only way to get this.
    return await network;
  } catch {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw new Error(`Offline and no cached copy of ${key}`);
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The course search proxies a live third-party API — never serve a stale
  // result, and never pretend it worked offline. The page handles the failure.
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build output and self-hosted fonts: immutable.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // The MoveNet weights (~4.6MB). Cached on first use rather than at install,
  // so someone who never opens swing analysis doesn't pay for the download.
  if (url.pathname.startsWith("/models/")) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  if (isRscRequest(url)) {
    event.respondWith(networkFirst(request, SHELL_CACHE, rscKey(url)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request, SHELL_CACHE, shellKey(url));
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          // Fall back to this route's document, then to the dashboard, so a
          // cold offline start never lands on the browser's error page.
          return (
            (await cache.match(shellKey(url))) ??
            (await cache.match("/")) ??
            Response.error()
          );
        }
      })()
    );
    return;
  }

  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icon")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
