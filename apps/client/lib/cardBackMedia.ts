/**
 * Lz-28 card-back media layer: band maths, fit selection, fade geometry.
 *
 * Settled heuristic (Critiquito / Carlos): SVG and transparent PNG, or more than
 * 1.5× upscale → contain on paper (16 px inset, centred, ≤1.5×). Everything else
 * cover on focal point (centre when none). No dark/busy fade shift.
 */

import type { CardBackMediaContentFit } from './cardBackLayout';

/** Minimum visible image band as a fraction of face height. */
export const CARD_BACK_MEDIA_MIN_BAND_RATIO = 0.28;

/** Inset for contain-fit media on paper (guide §9.3). */
export const CARD_BACK_MEDIA_CONTAIN_INSET = 16;

/** Cap display scale for contain / low-res paths (no blur-fill). */
export const CARD_BACK_MEDIA_MAX_UPSCALE = 1.5;

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

export type CardBackMediaFitPlan = {
  contentFit: CardBackMediaContentFit;
  /** Why contain was chosen; null when covering. */
  reason: 'extension' | 'upscale' | null;
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
 * SVG or PNG → contain on paper (proxy for transparent / diagram-like media).
 * JPEG/WebP/etc. stay on the cover path unless upscale forces contain.
 */
export function mediaUrlPrefersContain(url: string): boolean {
  const path = mediaUrlPathname(url);
  return path.endsWith('.svg') || path.endsWith('.png');
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
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  slotWidth: number;
  slotHeight: number;
}): CardBackMediaFitPlan {
  if (mediaUrlPrefersContain(input.mediaUrl)) {
    return { contentFit: 'contain', reason: 'extension' };
  }
  const sw = input.sourceWidth ?? 0;
  const sh = input.sourceHeight ?? 0;
  if (sw > 0 && sh > 0) {
    const upscale = coverUpscaleFactor(sw, sh, input.slotWidth, input.slotHeight);
    if (upscale > CARD_BACK_MEDIA_MAX_UPSCALE) {
      return { contentFit: 'contain', reason: 'upscale' };
    }
  }
  return { contentFit: 'cover', reason: null };
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
