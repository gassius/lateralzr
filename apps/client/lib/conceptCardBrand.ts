import { MARK_ASPECT } from '../assets/images/lateralzrMark';
import { Palette } from '../constants/Colors';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign';
import { blendHexOver, contrastRatio } from './coachHintPresentation';

/**
 * Quiet Lateralzr mark texture on concept cards (ClickUp 869f64061).
 *
 * The lockup is the node graph feeding a lightbulb — not the wordmark.
 * Wordmark belongs on the laterality bar (separate ticket). The bulb here is
 * decorative texture, not a tappable feedback control.
 *
 * Light (white) ink on orange so the 48px title stays AA+ even when a
 * multiline wrap overlaps the watermark. A dark stamp would darken the slab
 * and drop current teal title contrast below large-text AA.
 */

export type CardBrandFace = 'front' | 'back';

export const CARD_BRAND_INK = Palette.ink;

/** Watermark fill — white so the orange slab lightens, never darkens. */
export const CARD_BRAND_FILL = '#ffffff';

export const CARD_BRAND_FACE_COLOR = Palette.orange;

/** Front title color this PR does not change (PR #51 may switch it to ink). */
export const CARD_BRAND_TITLE_COLOR = Palette.darkBlue;

/** Fallback face width: letterboxed preview content (~301) + 20px padding each side. */
export const CARD_BRAND_FALLBACK_FACE_WIDTH = 341;

/** Front mark is large enough to read as texture, not a logo badge. */
export const CARD_BRAND_FRONT_WIDTH_RATIO = 0.72;

/** Back mark stays a corner stamp so media / balanced copy keep the stage. */
export const CARD_BRAND_BACK_WIDTH_RATIO = 0.28;

/** Visible but secondary — well below the title's full-opacity ink. */
export const CARD_BRAND_FRONT_OPACITY = 0.18;

export const CARD_BRAND_BACK_OPACITY = 0.14;

/** Bottom inset so the front mark sits on the slab, not in the laterality gap. */
export const CARD_BRAND_FRONT_BOTTOM = 16;

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

/** Texture is always under the 48px title — never a competing type size. */
export function cardBrandIsSecondaryToTitle(
  titleSize: number = CONCEPT_FRONT_LABEL_FONT_SIZE,
): boolean {
  return (
    CARD_BRAND_FRONT_OPACITY < 1 &&
    CARD_BRAND_FRONT_WIDTH_RATIO < 1 &&
    titleSize >= CONCEPT_FRONT_LABEL_FONT_SIZE
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

/** Ink title (PR #51) must also stay AA+ if it lands on this watermark. */
export function cardBrandInkTitleContrast(face: CardBrandFace = 'front'): number {
  return contrastRatio(CARD_BRAND_INK, cardBrandBlendedFace(face));
}

/** Large-text WCAG AA (48px / 700). */
export const CARD_BRAND_TITLE_MIN_CONTRAST = 3;

export function cardBrandUsesMotion(): boolean {
  return false;
}

export function cardBrandIsInteractive(): boolean {
  return false;
}
