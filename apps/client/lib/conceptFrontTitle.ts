import { color, type } from '../theme/tokens';

/**
 * Card-front concept title (Lz-26 / Art Direction v3.3 §7.3 + §6.1).
 *
 * Left-aligned in the pattern-master title clear area. Default size is
 * `type.concept` (32). Concept teal on orange is contrast-safe only at
 * ≥ `type.conceptMinOnOrange` (24); below that, fall back to ink.
 *
 * Supersedes the v2 centered 48px ink lock in `conceptFrontLabelAlign`
 * (Lz-04 / Lz-14). Pattern clearing geometry is Lz-25 and consumes the
 * title rect measured here.
 */

export const CONCEPT_FRONT_TITLE_FONT_SIZE = type.concept;

export const CONCEPT_FRONT_TITLE_MIN_ON_ORANGE = type.conceptMinOnOrange;

export const CONCEPT_FRONT_TITLE_TEXT_ALIGN = 'left' as const;

/** Line-height ratio for the front title (v3.3 concept role). */
export const CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO = 1.15;

/**
 * Pattern-master `#title-clear-area` in card design units (358×560).
 * Lz-25 clears pattern ink around this box; layout here anchors into it.
 */
export const TITLE_CLEAR_AREA = {
  cardWidth: 358,
  cardHeight: 560,
  x: 20,
  y: 236,
  width: 318,
  height: 168,
} as const;

/** First baseline ≈ 52% of face height (Critiquito / pattern master). */
export const CONCEPT_FRONT_TITLE_BASELINE_RATIO = 0.52;

/**
 * Fraction of face height above the title block so a short one-liner’s
 * first baseline lands near {@link CONCEPT_FRONT_TITLE_BASELINE_RATIO}.
 */
export const CONCEPT_FRONT_TITLE_TOP_RATIO = 0.47;

export type ConceptFrontTitleRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Title colour for a given rendered px size (after any shrink × font scale).
 * Concept teal at ≥24; ink below.
 */
export function titleColor(renderedSize: number): string {
  return renderedSize >= CONCEPT_FRONT_TITLE_MIN_ON_ORANGE ? color.concept : color.ink;
}

/**
 * Effective rendered size for contrast: layout fontSize × OS font scale.
 * Callers pass `PixelRatio.getFontScale()` (default 1 for unit tests).
 */
export function conceptFrontTitleRenderedSize(
  fontSize: number = CONCEPT_FRONT_TITLE_FONT_SIZE,
  fontScale: number = 1,
): number {
  return fontSize * fontScale;
}

/** Default (unscaled) front-title colour at the concept token size. */
export const CONCEPT_FRONT_TITLE_COLOR = titleColor(CONCEPT_FRONT_TITLE_FONT_SIZE);
