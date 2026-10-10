/**
 * Tokens for grouping the laterality control with the card.
 * The control is part of the card composition — not a bezel-pinned footer.
 */

import { layout, tallScreenMinHeight, type } from '@/theme/tokens';

/** 48 px stepped-slider hit region (guide §10 / layout.recommendedTouchTarget). */
export const LATERALITY_RAIL_HEIGHT = layout.recommendedTouchTarget;

/** Label row: type.label line box (14 × 1.4 → 20; matches typography `label` role). */
export const LATERALITY_LABEL_ROW_HEIGHT = Math.round(type.label * 1.4);

/** Label + rail stacked under the card. */
export const LATERALITY_CONTROL_HEIGHT = LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;

/** @deprecated Use LATERALITY_CONTROL_HEIGHT — kept for a short transition window. */
export const LATERALITY_SUBMENU_HEIGHT = LATERALITY_CONTROL_HEIGHT;

/** Comfortable tap target size (≥44). */
export const LATERALITY_STEP_SIZE = layout.recommendedTouchTarget;

/** Horizontal inset — matches practice screen gutter (Lz-21). */
export const LATERALITY_ROW_PADDING_HORIZONTAL = layout.screenGutter;

/** Narrowest phone chrome the bar must fit (WEB_PHONE_MIN_WIDTH / iPhone SE). */
export const LATERALITY_BAR_MIN_ROW_WIDTH = 320;

/** Top inset on the card stack (above the card, not in the card–row gap). */
export const CARD_STACK_PADDING_TOP = 8;

export const MIN_CARD_AREA_HEIGHT = 260;

/**
 * Gap card bottom → control label (v3.3 §8).
 * 12 px normally; 16 px when usable height (viewport − safe areas) ≥ 800.
 */
export function lateralityCardGap(usableHeight: number): number {
  const height = Number.isFinite(usableHeight) ? usableHeight : 0;
  return height >= tallScreenMinHeight ? layout.cardToControlGapTall : layout.cardToControlGap;
}

/** Height reserved under the card for the laterality control + grouping gap. */
export function lateralityChromeReserve(usableHeight: number): number {
  return LATERALITY_CONTROL_HEIGHT + lateralityCardGap(usableHeight);
}

/** Vertical space the card stack may use once laterality sits under the card. */
export function cardStackAvailableHeight(usableHeight: number): number {
  return Math.max(MIN_CARD_AREA_HEIGHT, usableHeight - lateralityChromeReserve(usableHeight));
}
