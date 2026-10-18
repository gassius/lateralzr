import { media as mediaTokens } from '@/theme/tokens';
import { mediaUrlPathname } from './cardBackMedia';

/** Native loaders may omit a User-Agent; Wikimedia can block those requests. Do not send these on web. */
export const REMOTE_IMAGE_HEADERS: Record<string, string> = {
  'User-Agent': 'Lateralzr/1.0 (https://github.com/gassius/lateralzr; educational)',
  Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8',
};

/** Hosts the Laravel `/api/media` proxy is willing to fetch. Keep in sync with config/media.php. */
export const PROXYABLE_MEDIA_HOSTS = new Set(['upload.wikimedia.org']);

export function isProxyableMediaUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  return PROXYABLE_MEDIA_HOSTS.has(parsed.hostname.toLowerCase());
}

export function proxiedMediaUrl(mediaUrl: string, apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return `${base}/api/media?url=${encodeURIComponent(mediaUrl)}`;
}

/**
 * Web loads Wikimedia (and other allowlisted hotlinks) through the API proxy so
 * display does not depend on third-party CORS. Native keeps the original URL.
 */
export function displayMediaUrl(
  mediaUrl: string | null | undefined,
  platform: string,
  apiBaseUrl: string,
): string {
  const url = mediaUrl?.trim() ?? '';
  if (!url) return '';
  if (platform !== 'web') return url;
  if (!isProxyableMediaUrl(url)) return url;
  return proxiedMediaUrl(url, apiBaseUrl);
}

export function remoteImageHeadersForPlatform(platform: string): Record<string, string> | undefined {
  if (platform === 'web') return undefined;
  return REMOTE_IMAGE_HEADERS;
}

export function remoteImageSource(
  mediaUrl: string | null | undefined,
  platform: string,
  apiBaseUrl: string,
  requestWidth?: number,
): { uri: string; headers?: Record<string, string> } | null {
  const uri = resolveCardMediaUrl({
    mediaUrl,
    platform,
    apiBaseUrl,
    requestWidth,
  });
  if (!uri) return null;
  const headers = remoteImageHeadersForPlatform(platform);
  return headers ? { uri, headers } : { uri };
}

/** Band width × device pixel ratio, capped (guide §9.3). */
export function requestedMediaWidth(
  bandWidth: number,
  pixelRatio: number,
  cap: number = mediaTokens.maxRequestWidth,
): number {
  const w = Number.isFinite(bandWidth) ? bandWidth : 0;
  const pr = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  if (!(w > 0) || !(cap > 0)) return Math.max(1, cap);
  return Math.max(1, Math.min(cap, Math.round(w * pr)));
}

/**
 * Widths Wikimedia's upload CDN currently serves. Other `Npx-` values
 * (640, 780, 800, 1098, 1170, 1600, …) return 400.
 */
export const WIKIMEDIA_THUMB_WIDTHS = [330, 500, 960, 1280, 1920] as const;

function isWikimediaUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'upload.wikimedia.org';
  } catch {
    return false;
  }
}

/** Stored `Npx-` from a Wikimedia thumb path, or null for originals. */
export function wikimediaStoredThumbWidth(url: string): number | null {
  try {
    const match = new URL(url).pathname.match(/\/(\d+)px-[^/]+$/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Round requested width UP to the next standard Wikimedia size, never above
 * the stored thumb (or original) width, and never above the 1600 request cap
 * — so 1920 is unused and 1280 is the largest we ask for.
 */
export function snapWikimediaThumbWidth(
  requested: number,
  storedWidth: number | null = null,
): number {
  const need = Math.max(1, Math.round(requested));
  const cap = Math.min(
    mediaTokens.maxRequestWidth,
    storedWidth != null && storedWidth > 0 ? storedWidth : Number.POSITIVE_INFINITY,
  );
  const allowed = WIKIMEDIA_THUMB_WIDTHS.filter((w) => w <= cap);
  if (allowed.length === 0) {
    return storedWidth != null && storedWidth > 0 ? storedWidth : need;
  }
  return allowed.find((w) => w >= need) ?? allowed[allowed.length - 1]!;
}

/**
 * Prefer a raster Wikimedia thumb (especially for SVG on native) at a standard
 * width. Never rewrite to a size Wikimedia will 400. Unknown hosts stay as-is.
 */
export function rewriteWikimediaRequestUrl(url: string, width: number): string {
  if (!isWikimediaUploadUrl(url)) return url;
  const stored = wikimediaStoredThumbWidth(url);
  const snapped = snapWikimediaThumbWidth(width, stored);
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.includes('/thumb/')) {
      if (stored != null && snapped === stored) return url;
      const next = path.replace(/\/\d+px-([^/]+)$/, `/${snapped}px-$1`);
      if (next === path) return url;
      parsed.pathname = next;
      return parsed.toString();
    }
    // Original file: only invent a thumb for native SVG rasterisation.
    const original = path.match(
      /^\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
    );
    if (!original) return url;
    const file = original[3];
    if (!file.toLowerCase().endsWith('.svg')) return url;
    parsed.pathname = `/wikipedia/commons/thumb/${original[1]}/${original[2]}/${file}/${snapped}px-${file}.png`;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function mediaUrlLooksLikeSvg(url: string): boolean {
  return mediaUrlPathname(url).endsWith('.svg');
}

/**
 * Display URL: size the Wikimedia request, rasterise SVG on native, then proxy on web.
 */
export function resolveCardMediaUrl(input: {
  mediaUrl: string | null | undefined;
  platform: string;
  apiBaseUrl: string;
  requestWidth?: number;
}): string {
  const url = input.mediaUrl?.trim() ?? '';
  if (!url) return '';
  const width = input.requestWidth ?? mediaTokens.maxRequestWidth;
  const preferRaster =
    mediaTokens.nativePreferRasterForSvg &&
    input.platform !== 'web' &&
    mediaUrlLooksLikeSvg(url);
  const sized =
    preferRaster || (width > 0 && isWikimediaUploadUrl(url))
      ? rewriteWikimediaRequestUrl(url, width)
      : url;
  return displayMediaUrl(sized, input.platform, input.apiBaseUrl);
}
