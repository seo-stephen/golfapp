// Model location and offline-caching helpers, kept free of TensorFlow imports
// so Settings can check and prime the cache without pulling in the whole
// library (~1MB of JS) just to render a status line.

// Served from public/ rather than tfhub.dev: the first swing then works on a
// course with no signal, and the app doesn't break if Google moves the model.
export const MOVENET_MODEL_URL = "/models/movenet-lightning/model.json";

interface WeightsManifestEntry {
  paths?: string[];
}

/** model.json plus every weight shard it references. */
export async function modelAssetUrls(): Promise<string[]> {
  const res = await fetch(MOVENET_MODEL_URL);
  if (!res.ok) throw new Error(`Couldn't read the model manifest (${res.status})`);
  const manifest: { weightsManifest?: WeightsManifestEntry[] } = await res.json();
  const base = MOVENET_MODEL_URL.slice(0, MOVENET_MODEL_URL.lastIndexOf("/") + 1);
  const shards = (manifest.weightsManifest ?? []).flatMap((g) => g.paths ?? []);
  return [MOVENET_MODEL_URL, ...shards.map((p) => base + p)];
}

/**
 * Whether every model file is already in a Cache Storage entry, i.e. the swing
 * analyzer will work with no network. `caches.match` searches all caches, so
 * this doesn't need to know the service worker's cache names.
 */
export async function isModelCached(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const urls = await modelAssetUrls();
    const hits = await Promise.all(urls.map((u) => caches.match(u)));
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

/**
 * Fetches every model file so the service worker's cache-first handler stores
 * it. Returns the number of bytes pulled over the network.
 */
export async function cacheModelForOffline(): Promise<number> {
  const urls = await modelAssetUrls();
  let bytes = 0;
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url} (${res.status})`);
    bytes += (await res.blob()).size;
  }
  return bytes;
}
