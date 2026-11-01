/**
 * Process-wide cache of rasterised card-front patterns.
 * Keyed by layout size + XML fingerprint so remounts (swipe underlays) reuse
 * one Image layer instead of re-mounting hundreds of RNSVG UseViews.
 */

export type PatternBitmapCacheKey = string;

const MAX_ENTRIES = 24;

const uriByKey = new Map<PatternBitmapCacheKey, string>();
const inflightByKey = new Map<PatternBitmapCacheKey, Promise<string>>();

/** Stable fingerprint — length + djb2 of xml (avoid storing full xml as key). */
export function patternXmlFingerprint(xml: string): string {
  let h = 5381;
  for (let i = 0; i < xml.length; i += 1) {
    h = ((h << 5) + h + xml.charCodeAt(i)) >>> 0;
  }
  return `${xml.length.toString(36)}_${h.toString(36)}`;
}

export function buildPatternBitmapCacheKey(options: {
  width: number;
  height: number;
  pixelRatio: number;
  xml: string;
}): PatternBitmapCacheKey {
  const w = Math.round(options.width);
  const h = Math.round(options.height);
  const pr = Math.round(options.pixelRatio * 1000) / 1000;
  return `${w}x${h}@${pr}:${patternXmlFingerprint(options.xml)}`;
}

function touch(key: PatternBitmapCacheKey, uri: string): void {
  uriByKey.delete(key);
  uriByKey.set(key, uri);
  while (uriByKey.size > MAX_ENTRIES) {
    const oldest = uriByKey.keys().next().value;
    if (oldest == null) break;
    uriByKey.delete(oldest);
  }
}

export function getCachedPatternBitmap(key: PatternBitmapCacheKey): string | null {
  const uri = uriByKey.get(key);
  if (uri == null) return null;
  // Refresh LRU order.
  touch(key, uri);
  return uri;
}

export function setCachedPatternBitmap(key: PatternBitmapCacheKey, uri: string): void {
  touch(key, uri);
}

/**
 * Deduplicate concurrent captures for the same key (three stack cards can
 * request the same raster in one frame).
 */
export function runPatternBitmapCapture(
  key: PatternBitmapCacheKey,
  capture: () => Promise<string>,
): Promise<string> {
  const hit = getCachedPatternBitmap(key);
  if (hit != null) return Promise.resolve(hit);

  const existing = inflightByKey.get(key);
  if (existing != null) return existing;

  const pending = capture()
    .then((uri) => {
      setCachedPatternBitmap(key, uri);
      return uri;
    })
    .finally(() => {
      inflightByKey.delete(key);
    });
  inflightByKey.set(key, pending);
  return pending;
}

/** Test-only. */
export function clearPatternBitmapCacheForTests(): void {
  uriByKey.clear();
  inflightByKey.clear();
}

/** Test-only. */
export function patternBitmapCacheSizeForTests(): number {
  return uriByKey.size;
}
