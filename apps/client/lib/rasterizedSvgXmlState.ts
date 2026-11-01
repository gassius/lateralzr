/**
 * Display-state helpers for RasterizedSvgXml (B1: SVG stays until Image onLoad).
 * Kept pure so component contracts can be unit-tested without a renderer.
 */

export type RasterizedSvgXmlLayers = {
  /** data-URI to show in Image (null → no Image). */
  imageUri: string | null;
  /** Mount Image (may still be decoding). */
  showImage: boolean;
  /** Keep SvgAst until the Image for this cacheKey has fired onLoad (or forever on failure). */
  showSvg: boolean;
};

export function resolveRasterizedSvgXmlLayers(options: {
  cacheKey: string;
  /** URI peeked/captured for this cacheKey. */
  uri: string | null;
  /** cacheKey for which Image.onLoad has fired. */
  loadedCacheKey: string | null;
  captureFailed: boolean;
  /**
   * Web preview / Playwright: keep the live SvgAst forever so `#connectors`
   * stays queryable and pixels match the vector master (no Image swap).
   */
  preferLiveSvg?: boolean;
}): RasterizedSvgXmlLayers {
  if (options.preferLiveSvg === true) {
    return { imageUri: null, showImage: false, showSvg: true };
  }
  const imageUri = options.uri;
  const showImage = imageUri != null;
  const imageReady = showImage && options.loadedCacheKey === options.cacheKey;
  // On failure, stay on SVG permanently. Otherwise keep SVG until onLoad.
  const showSvg = options.captureFailed || !imageReady;
  return { imageUri, showImage, showSvg };
}

export function uriForCacheKey(
  cacheKey: string,
  peekedUri: string | null,
  session: { cacheKey: string; uri: string } | null,
): string | null {
  if (peekedUri != null) return peekedUri;
  if (session != null && session.cacheKey === cacheKey) return session.uri;
  return null;
}
