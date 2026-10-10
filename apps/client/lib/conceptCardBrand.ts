import { MARK_ASPECT } from '../assets/images/lateralzrMark';
import { CARD_BRAND_FILL as CARD_BRAND_FILL_TOKEN } from '../theme/cardBrand';
import { blendHexOver, contrastRatio } from '../theme/contrast';
import { color } from '../theme/tokens';
import {
  CONCEPT_FRONT_TITLE_COLOR,
  CONCEPT_FRONT_TITLE_FONT_SIZE,
} from './conceptFrontTitle';

/**
 * Quiet Lateralzr mark texture on concept cards (ClickUp 869f64061).
 *
 * The lockup is the node graph feeding a lightbulb — not the wordmark.
 * Wordmark belongs on the laterality bar (separate ticket). The bulb here is
 * decorative texture, not a tappable feedback control.
 *
 * Light (white) mark on orange so the v3.3 concept title (teal at ≥24 px,
 * ink below) stays readable when a multiline wrap overlaps the watermark.
 */

export type CardBrandFace = 'front' | 'back';

export const CARD_BRAND_INK = color.ink;

/** Watermark fill — white so the orange slab lightens, never darkens. */
export const CARD_BRAND_FILL = CARD_BRAND_FILL_TOKEN;

export const CARD_BRAND_FACE_COLOR = color.front;

/** Default front title colour (Lz-26): concept teal at the 32 px token size. */
export const CARD_BRAND_TITLE_COLOR = CONCEPT_FRONT_TITLE_COLOR;

/** Fallback face width: letterboxed preview content (~301) + 20px padding each side. */
export const CARD_BRAND_FALLBACK_FACE_WIDTH = 341;

/**
 * Front mark is a lower-edge texture, not a title-sized badge.
 * Phone-frame review: 0.72 sat the bulb behind the word and stole the stage.
 */
export const CARD_BRAND_FRONT_WIDTH_RATIO = 0.52;

/** Back mark stays a corner stamp so media / balanced copy keep the stage. */
export const CARD_BRAND_BACK_WIDTH_RATIO = 0.26;

/** Visible but secondary — well below the title's full-opacity ink. */
export const CARD_BRAND_FRONT_OPACITY = 0.16;

export const CARD_BRAND_BACK_OPACITY = 0.12;

/** Sit the mark on the lower slab so the title keeps the lower-middle stage. */
export const CARD_BRAND_FRONT_BOTTOM = 6;

export const CARD_BRAND_BACK_BOTTOM = 10;
export const CARD_BRAND_BACK_RIGHT = 8;

export type CardBrandTokens = {
  widthRatio: number;
  opacity: number;
  fill: string;
};

export const CARD_BRAND_FRONT: CardBrandTokens = {
  widthRatio: CARD_BRAND_FRONT_WIDTH_RATIO,
  opacity: CARD_BRAND_FRONT_OPACITY,
  fill: CARD_BRAND_FILL,
};

export const CARD_BRAND_BACK: CardBrandTokens = {
  widthRatio: CARD_BRAND_BACK_WIDTH_RATIO,
  opacity: CARD_BRAND_BACK_OPACITY,
  fill: CARD_BRAND_FILL,
};

export function cardBrandTokens(face: CardBrandFace): CardBrandTokens {
  return face === 'front' ? CARD_BRAND_FRONT : CARD_BRAND_BACK;
}

export function cardBrandSize(
  faceWidth: number,
  face: CardBrandFace,
): { width: number; height: number } {
  const tokens = cardBrandTokens(face);
  const source = faceWidth > 0 ? faceWidth : CARD_BRAND_FALLBACK_FACE_WIDTH;
  const width = Math.max(0, source * tokens.widthRatio);
  return { width, height: width / MARK_ASPECT };
}

/** Texture is always under the concept title — never a competing type size. */
export function cardBrandIsSecondaryToTitle(
  titleSize: number = CONCEPT_FRONT_TITLE_FONT_SIZE,
): boolean {
  return (
    CARD_BRAND_FRONT_OPACITY < 1 &&
    CARD_BRAND_FRONT_WIDTH_RATIO < 1 &&
    titleSize >= CONCEPT_FRONT_TITLE_FONT_SIZE
  );
}

export function cardBrandBlendedFace(face: CardBrandFace): string {
  const { fill, opacity } = cardBrandTokens(face);
  return blendHexOver(fill, opacity, CARD_BRAND_FACE_COLOR);
}

export function cardBrandTitleContrast(face: CardBrandFace = 'front'): number {
  return contrastRatio(CARD_BRAND_TITLE_COLOR, cardBrandBlendedFace(face));
}

export function cardBrandPlainTitleContrast(): number {
  return contrastRatio(CARD_BRAND_TITLE_COLOR, CARD_BRAND_FACE_COLOR);
}

/** Ink fallback (Lz-26 when rendered size < 24) must stay AA+ on the watermark. */
export function cardBrandInkTitleContrast(face: CardBrandFace = 'front'): number {
  return contrastRatio(CARD_BRAND_INK, cardBrandBlendedFace(face));
}

/**
 * Large-text WCAG AA for the default concept-teal title on orange (≈3.15:1).
 * Ink fallback still clears normal-text AA (4.5) via {@link cardBrandInkTitleContrast}.
 */
export const CARD_BRAND_TITLE_MIN_CONTRAST = 3;
