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
): { uri: string; headers?: Record<string, string> } | null {
  const uri = displayMediaUrl(mediaUrl, platform, apiBaseUrl);
  if (!uri) return null;
  const headers = remoteImageHeadersForPlatform(platform);
  return headers ? { uri, headers } : { uri };
}
