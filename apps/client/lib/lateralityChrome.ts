/**
 * Tokens for grouping the laterality control with the card.
 * The control is part of the card composition — not a bezel-pinned footer.
 */

import { coachHintSlotHeight } from './coachHintPresentation';
import { layout, tallScreenMinHeight, type } from '@/theme/tokens';

/** 48 px stepped-slider hit region (guide §10 / layout.recommendedTouchTarget). */
export const LATERALITY_RAIL_HEIGHT = layout.recommendedTouchTarget;

/**
 * Minimum label row: type.label line box at 100% (14 × 1.4 → 20).
 * At large text the row grows (wrap); callers reserve measured control height.
 */
export const LATERALITY_LABEL_ROW_HEIGHT = Math.round(type.label * 1.4);

/**
 * Status-only content height (two meta lines at 13 × 1.4 → 18 × 2 = 36).
 * Tip chip needs a taller band — see {@link CONTROL_MESSAGING_BAND_HEIGHT}.
 */
export const STATUS_BAND_LINE_HEIGHT = Math.round(type.meta * 1.4);
export const STATUS_BAND_HEIGHT = STATUS_BAND_LINE_HEIGHT * 2;

/**
 * Shared tip-or-status messaging band above the Laterality label (AD #119).
 * One fixed height for every state: max(status 2-line, tip 2-line chip).
 * Tip and status never stack — they share this band (not sum).
 */
export const CONTROL_MESSAGING_BAND_HEIGHT = Math.max(
  STATUS_BAND_HEIGHT,
  coachHintSlotHeight(),
);

/**
 * Minimum control height: shared messaging band + label + rail.
 * Band is always reserved (empty / tip / status) so the card frame never shifts.
 */
export const LATERALITY_CONTROL_HEIGHT =
  CONTROL_MESSAGING_BAND_HEIGHT + LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;

/** Comfortable tap target size (≥44). */
export const LATERALITY_STEP_SIZE = layout.recommendedTouchTarget;

/** Horizontal inset — matches practice screen gutter (Lz-21). */
export const LATERALITY_ROW_PADDING_HORIZONTAL = layout.screenGutter;

/** Narrowest phone chrome the bar must fit (WEB_PHONE_MIN_WIDTH / iPhone SE). */
export const LATERALITY_BAR_MIN_ROW_WIDTH = 320;

/**
 * Minimum width for the Lz-35 status band copy.
 * Keeps meta word-wrapping (not one glyph per line) at 200% text.
 * ~longest status word at meta×2 ("starting" / "Buscando").
 */
export const STATUS_SLOT_MIN_WIDTH = 120;

export const MIN_CARD_AREA_HEIGHT = 260;

/**
 * Gap card bottom → control label (v3.3 §8).
 * 12 px normally; 16 px when usable height (viewport − safe areas) ≥ 800.
 */
export function lateralityCardGap(usableHeight: number): number {
  const height = Number.isFinite(usableHeight) ? usableHeight : 0;
  return height >= tallScreenMinHeight ? layout.cardToControlGapTall : layout.cardToControlGap;
}

/**
 * Height reserved under the card for the laterality control + grouping gap.
 * Pass the measured control height when the label wraps (large text).
 */
export function lateralityChromeReserve(
  usableHeight: number,
  controlHeight: number = LATERALITY_CONTROL_HEIGHT,
): number {
  const control =
    Number.isFinite(controlHeight) && controlHeight > 0
      ? Math.max(LATERALITY_CONTROL_HEIGHT, controlHeight)
      : LATERALITY_CONTROL_HEIGHT;
  return control + lateralityCardGap(usableHeight);
}

/** Vertical space the card stack may use once laterality sits under the card. */
export function cardStackAvailableHeight(
  usableHeight: number,
  controlHeight: number = LATERALITY_CONTROL_HEIGHT,
): number {
  return Math.max(
    MIN_CARD_AREA_HEIGHT,
    usableHeight - lateralityChromeReserve(usableHeight, controlHeight),
  );
}
