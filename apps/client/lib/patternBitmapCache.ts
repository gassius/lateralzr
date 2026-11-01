/**
 * Process-wide cache of rasterised card-front patterns.
 * Keyed by layout size + pixel ratio + preserveAspectRatio + XML fingerprint
 * so remounts reuse one Image layer instead of re-mounting RNSVG UseViews.
 */

export type PatternBitmapCacheKey = string;

/** Soft cap on retained textures (decoded RGBA estimate). */
export const PATTERN_BITMAP_MAX_CACHE_BYTES = 24 * 1024 * 1024;
export const PATTERN_BITMAP_MAX_ENTRIES = 24;
export const PATTERN_BITMAP_MAX_PIXEL_RATIO = 3;
export const PATTERN_BITMAP_MAX_EDGE = 2048;

const uriByKey = new Map<PatternBitmapCacheKey, string>();
const bytesByKey = new Map<PatternBitmapCacheKey, number>();
const inflightByKey = new Map<PatternBitmapCacheKey, Promise<string>>();
let totalBytes = 0;

/** Stable fingerprint — length + djb2 of xml (avoid storing full xml as key). */
export function patternXmlFingerprint(xml: string): string {
  let h = 5381;
  for (let i = 0; i < xml.length; i += 1) {
    h = ((h << 5) + h + xml.charCodeAt(i)) >>> 0;
  }
  return `${xml.length.toString(36)}_${h.toString(36)}`;
}

/** Cap device pixel ratio and long edge so one bitmap stays bounded. */
export function resolveCapturePixelSize(options: {
  width: number;
  height: number;
  pixelRatio: number;
  maxPixelRatio?: number;
  maxEdge?: number;
}): { width: number; height: number; pixelRatio: number } {
  const maxPr = options.maxPixelRatio ?? PATTERN_BITMAP_MAX_PIXEL_RATIO;
  const maxEdge = options.maxEdge ?? PATTERN_BITMAP_MAX_EDGE;
  const pixelRatio = Math.min(Math.max(options.pixelRatio, 1), maxPr);
  let width = Math.max(1, Math.round(options.width * pixelRatio));
  let height = Math.max(1, Math.round(options.height * pixelRatio));
  const longEdge = Math.max(width, height);
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  return { width, height, pixelRatio };
}

export function estimatePatternBitmapBytes(pixelWidth: number, pixelHeight: number): number {
  return Math.max(1, pixelWidth) * Math.max(1, pixelHeight) * 4;
}

export function buildPatternBitmapCacheKey(options: {
  width: number;
  height: number;
  pixelRatio: number;
  xml: string;
  preserveAspectRatio: string;
}): PatternBitmapCacheKey {
  const capture = resolveCapturePixelSize(options);
  const w = Math.round(options.width);
  const h = Math.round(options.height);
  const pr = Math.round(capture.pixelRatio * 1000) / 1000;
  const par = options.preserveAspectRatio.trim() || 'xMidYMid slice';
  return `${w}x${h}@${pr}:${par}:${patternXmlFingerprint(options.xml)}`;
}

/** Read without mutating LRU order (safe during render). */
export function peekCachedPatternBitmap(key: PatternBitmapCacheKey): string | null {
  return uriByKey.get(key) ?? null;
}

function evictWhileOverBudget(): void {
  while (
    (uriByKey.size > PATTERN_BITMAP_MAX_ENTRIES || totalBytes > PATTERN_BITMAP_MAX_CACHE_BYTES) &&
    uriByKey.size > 0
  ) {
    const oldest = uriByKey.keys().next().value;
    if (oldest == null) break;
    uriByKey.delete(oldest);
    const bytes = bytesByKey.get(oldest) ?? 0;
    bytesByKey.delete(oldest);
    totalBytes = Math.max(0, totalBytes - bytes);
  }
}

function touch(key: PatternBitmapCacheKey, uri: string, bytes: number): void {
  const prev = bytesByKey.get(key);
  if (prev != null) {
    totalBytes = Math.max(0, totalBytes - prev);
  }
  uriByKey.delete(key);
  uriByKey.set(key, uri);
  bytesByKey.set(key, bytes);
  totalBytes += bytes;
  evictWhileOverBudget();
}

export function getCachedPatternBitmap(key: PatternBitmapCacheKey): string | null {
  const uri = uriByKey.get(key);
  if (uri == null) return null;
  const bytes = bytesByKey.get(key) ?? 0;
  touch(key, uri, bytes);
  return uri;
}

export function setCachedPatternBitmap(
  key: PatternBitmapCacheKey,
  uri: string,
  bytes = 0,
): void {
  touch(key, uri, bytes > 0 ? bytes : Math.max(1, Math.floor(uri.length * 0.75)));
}

/**
 * Deduplicate concurrent captures for the same key (three stack cards can
 * request the same raster in one frame).
 */
export function runPatternBitmapCapture(
  key: PatternBitmapCacheKey,
  capture: () => Promise<string>,
  bytes = 0,
): Promise<string> {
  const hit = peekCachedPatternBitmap(key);
  if (hit != null) {
    getCachedPatternBitmap(key);
    return Promise.resolve(hit);
  }

  const existing = inflightByKey.get(key);
  if (existing != null) return existing;

  const pending = capture()
    .then((uri) => {
      setCachedPatternBitmap(key, uri, bytes);
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
  bytesByKey.clear();
  inflightByKey.clear();
  totalBytes = 0;
}

/** Test-only. */
export function patternBitmapCacheSizeForTests(): number {
  return uriByKey.size;
}

/** Test-only. */
export function patternBitmapCacheBytesForTests(): number {
  return totalBytes;
}
