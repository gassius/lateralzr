/**
 * Tokens for grouping the laterality row with the card.
 * The row is part of the card composition — not a bezel-pinned footer.
 */

import { layout } from '@/theme/tokens';
import { WORDMARK_ASPECT } from '../assets/images/lateralzrWordmark';

/** − / wordmark / + row. Keep ≥44px targets inside this height. */
export const LATERALITY_SUBMENU_HEIGHT = 72;

/** Comfortable tap target for − / + (visually weightier than a 44px ghost). */
export const LATERALITY_STEP_SIZE = 48;

/** Preferred logo wordmark strip height on a wide phone. Scales down on 320–375. */
export const LATERALITY_WORDMARK_HEIGHT = 28;

/** Preferred connected-nodes motif width (not the reserved lightbulb). Scales with the wordmark. */
export const LATERALITY_NODES_WIDTH = 32;

/** Horizontal inset on the − / wordmark / + row — matches practice screen gutter (Lz-21). */
export const LATERALITY_ROW_PADDING_HORIZONTAL = layout.screenGutter;

/**
 * §5.2 — logo/wordmark never sits directly on shell (#082D3D).
 * Until Lz-30 removes the wordmark from the bar, it rides an orange tile (`front`).
 */
export const LATERALITY_WORDMARK_SURFACE: 'front' = 'front';

/** Inset around the wordmark paths inside the orange tile. */
export const LATERALITY_WORDMARK_TILE_PAD_X = 10;
export const LATERALITY_WORDMARK_TILE_PAD_Y = 6;
export const LATERALITY_WORDMARK_TILE_RADIUS = 8;

/** Gap between the five row slots (step, nodes, word, nodes, step). */
export const LATERALITY_ROW_GAP = 6;

const LATERALITY_ROW_ITEM_COUNT = 5;
const LATERALITY_ROW_GAP_COUNT = LATERALITY_ROW_ITEM_COUNT - 1;

/** Flush attach under the card — close the Lz-11 orphaned teal band. */
export const LATERALITY_CARD_GAP = 2;

/** Narrowest phone chrome the bar must fit (WEB_PHONE_MIN_WIDTH / iPhone SE). */
export const LATERALITY_BAR_MIN_ROW_WIDTH = 320;

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

export type LateralityBarFit = {
  rowWidth: number;
  stepSize: number;
  paddingHorizontal: number;
  gap: number;
  nodesWidth: number;
  wordmarkWidth: number;
  wordmarkHeight: number;
  totalWidth: number;
};

/** Fixed chrome that does not shrink: padding + −/+ + gaps. */
export function lateralityBarReservedWidth(): number {
  return (
    LATERALITY_ROW_PADDING_HORIZONTAL * 2 +
    LATERALITY_STEP_SIZE * 2 +
    LATERALITY_ROW_GAP * LATERALITY_ROW_GAP_COUNT
  );
}

export function lateralityBarPreferredWordmarkWidth(): number {
  return Math.round(LATERALITY_WORDMARK_HEIGHT * WORDMARK_ASPECT);
}

/** Extra horizontal space the §5.2 orange wordmark tile needs beyond the paths. */
export function lateralityWordmarkTileExtraWidth(): number {
  return LATERALITY_WORDMARK_TILE_PAD_X * 2;
}

/**
 * Size the wordmark + nodes from the width left after −/+ and padding.
 * Steps stay 48px so tap targets do not shrink on SE-class frames.
 * Wordmark path width excludes the orange tile pad (counted separately so the row still fits).
 */
export function lateralityBarFit(rowWidth: number): LateralityBarFit {
  const width = Number.isFinite(rowWidth) ? Math.max(0, Math.floor(rowWidth)) : 0;
  const reserved = lateralityBarReservedWidth();
  const tileExtra = lateralityWordmarkTileExtraWidth();
  const remaining = Math.max(0, width - reserved);
  const preferredWordmark = lateralityBarPreferredWordmarkWidth();
  const preferredNodes = LATERALITY_NODES_WIDTH;
  const preferredMiddle = preferredWordmark + preferredNodes * 2 + tileExtra;

  let nodesWidth: number;
  let wordmarkWidth: number;
  if (preferredMiddle <= remaining) {
    nodesWidth = preferredNodes;
    wordmarkWidth = preferredWordmark;
  } else if (remaining <= tileExtra) {
    nodesWidth = 0;
    wordmarkWidth = 0;
  } else {
    const pathBudget = remaining - tileExtra;
    const pathPreferred = preferredWordmark + preferredNodes * 2;
    const scale = pathBudget / pathPreferred;
    nodesWidth = Math.floor(preferredNodes * scale);
    wordmarkWidth = Math.max(0, pathBudget - nodesWidth * 2);
  }

  const wordmarkTileWidth = wordmarkWidth > 0 ? wordmarkWidth + tileExtra : 0;

  return {
    rowWidth: width,
    stepSize: LATERALITY_STEP_SIZE,
    paddingHorizontal: LATERALITY_ROW_PADDING_HORIZONTAL,
    gap: LATERALITY_ROW_GAP,
    nodesWidth,
    wordmarkWidth,
    wordmarkHeight: wordmarkWidth > 0 ? wordmarkWidth / WORDMARK_ASPECT : 0,
    totalWidth: reserved + nodesWidth * 2 + wordmarkTileWidth,
  };
}
