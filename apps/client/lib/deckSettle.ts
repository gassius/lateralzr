/**
 * Settle timing when a concept replaces the end-of-deck loading face (Lz-36).
 * Same tokens as quiet swipe settle / RM cross-fade.
 */

import { motion } from '@/theme/tokens';
import {
  SWIPE_REDUCED_MOTION_CROSSFADE_MS,
  SWIPE_SETTLE_MS,
  swipeCommitDurationMs,
  swipeEnterShiftPx,
} from '@/lib/cardSwipe';

/** Full-motion settle when the next card replaces loading (token: motion.swipeSettleMs). */
export const DECK_SETTLE_MS = SWIPE_SETTLE_MS;

/** Reduced-motion cross-fade for that replace (token: motion.reducedMotionCrossfadeMs). */
export const DECK_SETTLE_REDUCED_MS = SWIPE_REDUCED_MOTION_CROSSFADE_MS;

export function deckSettleDurationMs(reduceMotion: boolean): number {
  return swipeCommitDurationMs(reduceMotion);
}

export function deckSettleEnterShiftPx(reduceMotion: boolean, forward: boolean): number {
  return swipeEnterShiftPx(reduceMotion, forward);
}

/** Pin helpers to theme tokens (unit tests). */
export function deckSettleTokens() {
  return {
    settleMs: motion.swipeSettleMs,
    reducedMotionCrossfadeMs: motion.reducedMotionCrossfadeMs,
  };
}
