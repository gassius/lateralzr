/**
 * Pattern placement + title clearing (Lz-25 / Art Direction v3.3 §11).
 *
 * Variant is stable per concept key across flip, backtrack, and tree swaps.
 * Motifs whose bbox intersects the measured title box + 16 px are hidden —
 * never moved. The SVG `#title-clear-area` is the default clear when no
 * measured title is available yet.
 */

import { PATTERN_SVG_BY_VARIANT } from '../assets/images/pattern/patternXml';
import {
  PATTERN_CARD_UNITS,
  PATTERN_TITLE_CLEAR_MARGIN_PX,
} from '../theme/pattern';
import {
  PATTERN_VARIANT_PLACEMENTS,
  type PatternMotifPlacement,
  type PatternTitleClearRect,
} from './patternVariantPlacements';

export type PatternVariantIndex = 0 | 1 | 2;

export type PatternRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const PATTERN_VARIANT_NAMES = [
  'descending-current',
  'ascending-current',
  'edge-current',
] as const;

export type PatternVariantName = (typeof PATTERN_VARIANT_NAMES)[number];

/**
 * Local AABB of the motif mark in motif-local units (before placement).
 * Matches the logo mark crop centered by the SVG's `translate(-143 -97)`.
 */
export const MOTIF_LOCAL_BOUNDS = {
  x: 48,
  y: 4,
  width: 196,
  height: 204,
} as const;

/** Unsigned 32-bit djb2 — stable across JS engines for ASCII concept keys. */
export function hashConceptKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i += 1) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** `variantFor(conceptKey) = hash(key) % 3` — same concept ⇒ same variant. */
export function variantFor(conceptKey: string): PatternVariantIndex {
  const key = conceptKey.trim().toLowerCase();
  if (key.length === 0) return 0;
  return (hashConceptKey(key) % 3) as PatternVariantIndex;
}

export function patternVariantName(index: PatternVariantIndex): PatternVariantName {
  return PATTERN_VARIANT_NAMES[index];
}

export function patternSvgForVariant(index: PatternVariantIndex): string {
  return PATTERN_SVG_BY_VARIANT[index];
}

export function defaultTitleClearForVariant(index: PatternVariantIndex): PatternTitleClearRect {
  return PATTERN_VARIANT_PLACEMENTS[index].titleClear;
}

export function expandRect(rect: PatternRect, margin: number): PatternRect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

export function rectsIntersect(a: PatternRect, b: PatternRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Axis-aligned bbox of a placed motif in card design units (358×560).
 * Transform order matches the SVG: translate(cx,cy) → rotate → scale → translate(ox,oy).
 */
export function motifBoundingBox(placement: PatternMotifPlacement): PatternRect {
  const { cx, cy, rotate, sx, sy, ox, oy } = placement;
  const local = MOTIF_LOCAL_BOUNDS;
  const corners: Array<[number, number]> = [
    [local.x, local.y],
    [local.x + local.width, local.y],
    [local.x + local.width, local.y + local.height],
    [local.x, local.y + local.height],
  ];
  const cos = Math.cos(degToRad(rotate));
  const sin = Math.sin(degToRad(rotate));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [lx, ly] of corners) {
    const x1 = lx + ox;
    const y1 = ly + oy;
    const x2 = x1 * sx;
    const y2 = y1 * sy;
    const x3 = x2 * cos - y2 * sin;
    const y3 = x2 * sin + y2 * cos;
    const x = x3 + cx;
    const y = y3 + cy;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Motif ids whose bbox intersects `clearArea` (already in card design units).
 * Callers pass measured title box + {@link PATTERN_TITLE_CLEAR_MARGIN_PX}, or the
 * SVG default clear rect when no measurement is available.
 */
export function motifsIntersectingClearArea(
  variant: PatternVariantIndex,
  clearArea: PatternRect,
): string[] {
  const hidden: string[] = [];
  for (const motif of PATTERN_VARIANT_PLACEMENTS[variant].motifs) {
    if (rectsIntersect(motifBoundingBox(motif), clearArea)) {
      hidden.push(motif.id);
    }
  }
  return hidden;
}

/**
 * Effective clear area in card design units.
 * Prefer measured title (face px → viewBox with xMidYMid slice) + 16 px margin.
 * Fall back to the SVG `#title-clear-area` when title has not been measured.
 */
export function resolvePatternClearArea(options: {
  variant: PatternVariantIndex;
  titleFaceRect: PatternRect | null;
  faceWidth: number;
  faceHeight: number;
  margin?: number;
}): PatternRect {
  const margin = options.margin ?? PATTERN_TITLE_CLEAR_MARGIN_PX;
  const { titleFaceRect, faceWidth, faceHeight, variant } = options;
  if (
    titleFaceRect != null &&
    titleFaceRect.width > 0 &&
    titleFaceRect.height > 0 &&
    faceWidth > 0 &&
    faceHeight > 0
  ) {
    // Expand in face pixels first (Carlos: measured title box + 16 px), then map.
    const paddedFace = expandRect(titleFaceRect, margin);
    return faceRectToCardUnits(paddedFace, faceWidth, faceHeight);
  }
  return defaultTitleClearForVariant(variant);
}

/** Uniform scale for `preserveAspectRatio="xMidYMid slice"`. */
export function sliceScale(faceWidth: number, faceHeight: number): number {
  const { width: vbW, height: vbH } = PATTERN_CARD_UNITS;
  return Math.max(faceWidth / vbW, faceHeight / vbH);
}

/** Map a rect from face pixels into pattern viewBox (card) units. */
export function faceRectToCardUnits(
  faceRect: PatternRect,
  faceWidth: number,
  faceHeight: number,
): PatternRect {
  const { width: vbW, height: vbH } = PATTERN_CARD_UNITS;
  const scale = sliceScale(faceWidth, faceHeight);
  const dispW = vbW * scale;
  const dispH = vbH * scale;
  const offX = (faceWidth - dispW) / 2;
  const offY = (faceHeight - dispH) / 2;
  return {
    x: (faceRect.x - offX) / scale,
    y: (faceRect.y - offY) / scale,
    width: faceRect.width / scale,
    height: faceRect.height / scale,
  };
}

/**
 * Hide motif instances (bulbs, connector uses, pulse groups) by id.
 * Does not rewrite path geometry — only adds `display="none"`.
 */
export function hideMotifsInPatternSvg(xml: string, motifIds: readonly string[]): string {
  if (motifIds.length === 0) return xml;
  const hide = new Set(motifIds);
  return xml.replace(
    /<(use|g)\b([^>]*?)\sdata-motif="(m\d+)"([^>]*?)(\/?)>/g,
    (full, tag: string, pre: string, motifId: string, post: string, selfClose: string) => {
      if (!hide.has(motifId)) return full;
      if (/\bdisplay\s*=/.test(full)) return full;
      if (selfClose === '/') {
        return `<${tag}${pre} data-motif="${motifId}"${post} display="none"/>`;
      }
      return `<${tag}${pre} data-motif="${motifId}"${post} display="none">`;
    },
  );
}

/**
 * Build the SvgXml string for a concept: pick variant, apply title clearing.
 * `titleFaceRect` is in face pixels (origin = top-left of the orange face).
 */
export function buildPatternSvgXml(options: {
  conceptKey: string;
  titleFaceRect: PatternRect | null;
  faceWidth: number;
  faceHeight: number;
  /** Test-only override (0–2). */
  variantOverride?: PatternVariantIndex | null;
}): { variant: PatternVariantIndex; xml: string; hiddenMotifs: string[] } {
  const variant =
    options.variantOverride != null
      ? options.variantOverride
      : variantFor(options.conceptKey);
  const clearArea = resolvePatternClearArea({
    variant,
    titleFaceRect: options.titleFaceRect,
    faceWidth: options.faceWidth,
    faceHeight: options.faceHeight,
  });
  const hiddenMotifs = motifsIntersectingClearArea(variant, clearArea);
  const xml = hideMotifsInPatternSvg(patternSvgForVariant(variant), hiddenMotifs);
  return { variant, xml, hiddenMotifs };
}

export { PATTERN_TITLE_CLEAR_MARGIN_PX, PATTERN_CARD_UNITS };
