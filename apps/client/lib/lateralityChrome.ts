/**
 * Tokens for grouping the laterality row with the card.
 * The row is part of the card composition — not a bezel-pinned footer.
 */

/** − / wordmark / + row. Keep ≥44px targets inside this height. */
export const LATERALITY_SUBMENU_HEIGHT = 72;

/** Comfortable tap target for − / + (visually weightier than a 44px ghost). */
export const LATERALITY_STEP_SIZE = 48;

/** Logo wordmark strip height inside the row. */
export const LATERALITY_WORDMARK_HEIGHT = 28;

/** Connected-nodes motif (not the reserved lightbulb). */
export const LATERALITY_NODES_WIDTH = 32;

/** Flush attach under the card — close the Lz-11 orphaned teal band. */
export const LATERALITY_CARD_GAP = 2;

/** Top inset on the card stack (above the card, not in the card–row gap). */
export const CARD_STACK_PADDING_TOP = 8;

export const MIN_CARD_AREA_HEIGHT = 260;

/** Height reserved under the card for the laterality row + grouping gap. */
export function lateralityChromeReserve(): number {
  return LATERALITY_SUBMENU_HEIGHT + LATERALITY_CARD_GAP;
}

/** Vertical space the card stack may use once laterality sits under the card. */
export function cardStackAvailableHeight(usableHeight: number): number {
  return Math.max(MIN_CARD_AREA_HEIGHT, usableHeight - lateralityChromeReserve());
}
