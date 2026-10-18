/**
 * Lz-28 / Lz-55 card-back media layer: band maths, fit selection, fade geometry.
 *
 * v3.4 §9.3: purpose decides fit (photo → cover; diagram/map/artwork/text-bearing
 * → contain). Unknown purpose falls back to measurement (JPEG/WebP, aspect
 * 0.6–1.8, upscale ≤ 1.5 → cover; else contain). Never the file extension alone.
 */

import { media as mediaTokens } from '@/theme/tokens';
import type { CardBackMediaContentFit } from './cardBackLayout';

/** Minimum visible image band as a fraction of face height. */
export const CARD_BACK_MEDIA_MIN_BAND_RATIO = 0.28;

/** Inset for contain-fit media on paper (guide §9.3 / tokens.media). */
export const CARD_BACK_MEDIA_CONTAIN_INSET = mediaTokens.containInset;

/** Cap display scale for contain / low-res paths (no blur-fill). */
export const CARD_BACK_MEDIA_MAX_UPSCALE = mediaTokens.maxUpscale;

export const CARD_BACK_MEDIA_DECODE_TIMEOUT_MS = mediaTokens.decodeTimeoutMs;
export const CARD_BACK_MEDIA_FADE_IN_MS = mediaTokens.imageFadeInMs;
export const CARD_BACK_MEDIA_MAX_REQUEST_WIDTH = mediaTokens.maxRequestWidth;
export const CARD_BACK_MEDIA_COVER_ASPECT_MIN = mediaTokens.measuredCoverAspect[0];
export const CARD_BACK_MEDIA_COVER_ASPECT_MAX = mediaTokens.measuredCoverAspect[1];

export const CARD_BACK_MEDIA_PURPOSES = [
  'photo',
  'diagram',
  'map',
  'artwork',
  'text-bearing',
] as const;

export type CardBackMediaPurpose = (typeof CARD_BACK_MEDIA_PURPOSES)[number];

/**
 * Fade occupies this fraction of the image band (transparent → paper), ending
 * at the reading-block edge. No dark/busy +15% shift.
 */
export const CARD_BACK_MEDIA_FADE_RATIO = 0.4;

/**
 * If forcing the 28% band would leave less than one body line for reading,
 * drop the image layer (Lz-27 no-media fallback).
 */
export const CARD_BACK_MEDIA_MIN_READING_STRIP = 27;

/**
 * Paper reading block overlaps the fade by this many px so the gradient end
 * does not show a 1 px seam against the opaque paper edge (guide §9.3).
 */
export const CARD_BACK_MEDIA_SEAM_OVERLAP = 2;

export type CardBackMediaBand = {
  bandHeight: number;
  /** True → collapse to no-media layout (Lz-27). */
  dropImage: boolean;
};

export type CardBackMediaFitReason =
  | 'purpose'
  | 'measured'
  | 'format'
  | 'aspect'
  | 'upscale';

export type CardBackMediaFitPlan = {
  contentFit: CardBackMediaContentFit;
  reason: CardBackMediaFitReason;
};

export type CardBackContainBox = {
  width: number;
  height: number;
  left: number;
  top: number;
};

export type CardBackMediaFade = {
  /** Y offset of the fade overlay within the band (from band top). */
  startY: number;
  height: number;
};

/**
 * Strip query/hash and return a lowercase pathname for extension checks.
 */
export function mediaUrlPathname(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      return new URL(trimmed).pathname.toLowerCase();
    }
  } catch {
    // fall through
  }
  const withoutHash = trimmed.split('#')[0] ?? trimmed;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  return withoutQuery.toLowerCase();
}

/**
 * Measured-fallback format gate (§9.3): cover is allowed only for JPEG/WebP.
 * PNG/SVG still contain, but because they fail this gate — not as a purpose proxy.
 */
export function mediaUrlIsJpegOrWebp(url: string): boolean {
  const path = mediaUrlPathname(url);
  return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.webp');
}

/** Decoded MIME from expo-image `onLoad` `source.mediaType`. */
export function mediaTypeIsJpegOrWebp(mediaType: string): boolean {
  const t = mediaType.toLowerCase();
  return t.includes('jpeg') || t.includes('jpg') || t.includes('webp');
}

export function isCardBackMediaPurpose(value: unknown): value is CardBackMediaPurpose {
  return (
    typeof value === 'string' &&
    (CARD_BACK_MEDIA_PURPOSES as readonly string[]).includes(value)
  );
}

/**
 * Cover scale factor for a source into a slot (max of axis scales).
 * Values above {@link CARD_BACK_MEDIA_MAX_UPSCALE} force contain.
 */
export function coverUpscaleFactor(
  sourceWidth: number,
  sourceHeight: number,
  slotWidth: number,
  slotHeight: number,
): number {
  if (
    !(sourceWidth > 0) ||
    !(sourceHeight > 0) ||
    !(slotWidth > 0) ||
    !(slotHeight > 0)
  ) {
    return 1;
  }
  return Math.max(slotWidth / sourceWidth, slotHeight / sourceHeight);
}

export function resolveCardBackMediaFit(input: {
  mediaUrl: string;
  purpose?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  /** Decoded MIME from `onLoad`; extension is used only when this is null. */
  mediaType?: string | null;
  slotWidth: number;
  slotHeight: number;
}): CardBackMediaFitPlan {
  if (isCardBackMediaPurpose(input.purpose)) {
    const mapped = mediaTokens.purposes[input.purpose];
    return { contentFit: mapped, reason: 'purpose' };
  }

  const jpegOrWebp =
    input.mediaType != null && input.mediaType.length > 0
      ? mediaTypeIsJpegOrWebp(input.mediaType)
      : mediaUrlIsJpegOrWebp(input.mediaUrl);
  if (!jpegOrWebp) {
    return { contentFit: 'contain', reason: 'format' };
  }

  const sw = input.sourceWidth ?? 0;
  const sh = input.sourceHeight ?? 0;
  if (sw > 0 && sh > 0) {
    const aspect = sw / sh;
    if (
      aspect < CARD_BACK_MEDIA_COVER_ASPECT_MIN ||
      aspect > CARD_BACK_MEDIA_COVER_ASPECT_MAX
    ) {
      return { contentFit: 'contain', reason: 'aspect' };
    }
    const upscale = coverUpscaleFactor(sw, sh, input.slotWidth, input.slotHeight);
    if (upscale > CARD_BACK_MEDIA_MAX_UPSCALE) {
      return { contentFit: 'contain', reason: 'upscale' };
    }
    return { contentFit: 'cover', reason: 'measured' };
  }

  // JPEG/WebP with no measurements yet — optimistic cover until onLoad.
  return { contentFit: 'cover', reason: 'measured' };
}

/**
 * Image band height and drop rule.
 * Prefer leftover height after the text block + bottom reading inset; never go
 * below 28% (text scrolls). Drop when even a 28% band leaves no usable strip.
 *
 * `readingInsetBottom` is the guide face padding (24 / 20) reserved under the
 * copy so Wikipedia / description never sit on the card edge.
 */
export function resolveCardBackMediaBand(
  faceHeight: number,
  textBlockHeight: number,
  readingInsetBottom: number = 0,
): CardBackMediaBand {
  if (!Number.isFinite(faceHeight) || faceHeight <= 0) {
    return { bandHeight: 0, dropImage: true };
  }
  const inset = Math.max(0, readingInsetBottom);
  const minBand = faceHeight * CARD_BACK_MEDIA_MIN_BAND_RATIO;
  const readingStripIfMin = faceHeight - minBand;
  if (readingStripIfMin < CARD_BACK_MEDIA_MIN_READING_STRIP + inset) {
    return { bandHeight: 0, dropImage: true };
  }
  // Before the reading block measures, keep the 28% floor so copy can lay out.
  if (!(textBlockHeight > 0)) {
    return { bandHeight: minBand, dropImage: false };
  }
  const readingNeed = textBlockHeight + inset;
  const naturalBand = faceHeight - readingNeed;
  const bandHeight = Math.max(minBand, naturalBand);
  return { bandHeight, dropImage: false };
}

/**
 * Fade overlay geometry inside the image band (no dark/busy offset).
 * Height reaches the band floor so the last gradient samples are fully paper.
 */
export function resolveCardBackMediaFade(bandHeight: number): CardBackMediaFade {
  if (!(bandHeight > 0)) {
    return { startY: 0, height: 0 };
  }
  const height = bandHeight * CARD_BACK_MEDIA_FADE_RATIO;
  const startY = Math.max(0, bandHeight - height);
  return {
    startY,
    // Reach the band edge (and a hair past via layout overlap in ConceptCard).
    height: bandHeight - startY,
  };
}

/**
 * Centred contain box inside the band, with inset and ≤1.5× source scale.
 */
export function resolveContainMediaBox(input: {
  sourceWidth: number;
  sourceHeight: number;
  slotWidth: number;
  slotHeight: number;
  inset?: number;
  maxUpscale?: number;
}): CardBackContainBox {
  const inset = input.inset ?? CARD_BACK_MEDIA_CONTAIN_INSET;
  const maxUpscale = input.maxUpscale ?? CARD_BACK_MEDIA_MAX_UPSCALE;
  const availW = Math.max(0, input.slotWidth - inset * 2);
  const availH = Math.max(0, input.slotHeight - inset * 2);
  if (
    !(input.sourceWidth > 0) ||
    !(input.sourceHeight > 0) ||
    availW <= 0 ||
    availH <= 0
  ) {
    return { width: 0, height: 0, left: inset, top: inset };
  }
  const fitScale = Math.min(availW / input.sourceWidth, availH / input.sourceHeight);
  const scale = Math.min(fitScale, maxUpscale);
  const width = Math.min(availW, Math.round(input.sourceWidth * scale));
  const height = Math.min(availH, Math.round(input.sourceHeight * scale));
  return {
    width,
    height,
    left: (input.slotWidth - width) / 2,
    top: (input.slotHeight - height) / 2,
  };
}
