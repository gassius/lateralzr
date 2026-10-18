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

function isWikimediaUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'upload.wikimedia.org';
  } catch {
    return false;
  }
}

/**
 * Prefer a raster Wikimedia thumb (especially for SVG on native) at `width` px.
 * Unknown hosts are left unchanged.
 */
export function rewriteWikimediaRequestUrl(url: string, width: number): string {
  const w = Math.max(1, Math.round(width));
  if (!isWikimediaUploadUrl(url) || !(w > 0)) return url;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.includes('/thumb/')) {
      parsed.pathname = path.replace(/\/\d+px-([^/]+)$/, `/${w}px-$1`);
      return parsed.toString();
    }
    const original = path.match(
      /^\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
    );
    if (!original) return url;
    const file = original[3];
    const isSvg = file.toLowerCase().endsWith('.svg');
    const thumbFile = isSvg ? `${file}.png` : file;
    parsed.pathname = `/wikipedia/commons/thumb/${original[1]}/${original[2]}/${file}/${w}px-${thumbFile}`;
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
