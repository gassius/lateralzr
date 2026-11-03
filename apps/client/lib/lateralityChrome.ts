/**
 * Tokens for grouping the laterality / complexity controls with the card
 * (ClickUp Lz-67 / guide §9.6, §9.7, §16.2).
 *
 * Messaging (coach tip / status) lives in the lower card gap — not inside
 * the Laterality control height — so the card never jumps when a status appears.
 */

import { coachHintSlotHeight } from './coachHintPresentation';
import { layout, type } from '@/theme/tokens';

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
 * Kept for DeckStatusLine / CoachHint sizing inside the lower card gap.
 */
export const STATUS_BAND_LINE_HEIGHT = Math.round(type.meta * 1.4);
export const STATUS_BAND_HEIGHT = STATUS_BAND_LINE_HEIGHT * 2;

/**
 * Shared tip-or-status content height (AD #119).
 * One fixed height for every state: max(status 2-line, tip 2-line chip).
 * Tip and status never stack — they share this slot in the lower card gap.
 */
export const CONTROL_MESSAGING_BAND_HEIGHT = Math.max(
  STATUS_BAND_HEIGHT,
  coachHintSlotHeight(),
);

/**
 * Laterality control height: label + rail only (v3.5 — messaging left the band).
 */
export const LATERALITY_CONTROL_HEIGHT =
  LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT;

/** Complexity bar mirrors Laterality: same label row + rail heights. */
export const COMPLEXITY_CONTROL_HEIGHT = LATERALITY_CONTROL_HEIGHT;

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
 * Minimum lower-gap height for one status line + 8 pt above and below (§16.2).
 */
export function messagingMinGapHeight(): number {
  return STATUS_BAND_LINE_HEIGHT + 8 + 8;
}

/**
 * Reference equal gap at 390×844 (token). Runtime gaps are derived from leftover
 * height after the preferred card; this pin documents the design target.
 */
export function cardGapAtReference(): number {
  return layout.cardGapAtReference;
}

/**
 * Height reserved under the card for the laterality label+rail only.
 * Equal gaps are handled separately by {@link resolveEqualCardGaps}.
 */
export function lateralityChromeReserve(
  controlHeight: number = LATERALITY_CONTROL_HEIGHT,
): number {
  const control =
    Number.isFinite(controlHeight) && controlHeight > 0
      ? Math.max(LATERALITY_CONTROL_HEIGHT, controlHeight)
      : LATERALITY_CONTROL_HEIGHT;
  return control;
}

/**
 * Split leftover height so the **visual** gaps match: Complexity rail
 * centreline → card top, and card bottom → Laterality label top (§16.2 / C6).
 *
 * The rail hit area extends {@link LATERALITY_RAIL_HEIGHT}/2 below the visible
 * rail line, so that slack is given to the lower gap. Messaging overlays inside
 * the lower gap at a fixed height so a tip cannot push Laterality.
 */
export function resolveEqualCardGaps(leftoverHeight: number): {
  above: number;
  below: number;
} {
  const leftover = Number.isFinite(leftoverHeight) ? Math.max(0, leftoverHeight) : 0;
  const railSlack = LATERALITY_RAIL_HEIGHT / 2;
  if (leftover <= railSlack) {
    return { above: 0, below: leftover };
  }
  const half = (leftover - railSlack) / 2;
  return { above: half, below: half + railSlack };
}

/**
 * Vertical space the card stack may use once header, Complexity, Laterality
 * chrome and equal gaps are accounted for. Prefer calling
 * {@link resolvePracticeCardRegion} from cardLayout for the full budget.
 */
export function cardStackAvailableHeight(
  usableHeight: number,
  controlHeight: number = LATERALITY_CONTROL_HEIGHT,
): number {
  return Math.max(
    MIN_CARD_AREA_HEIGHT,
    usableHeight - lateralityChromeReserve(controlHeight),
  );
}
