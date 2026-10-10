/**
 * Quiet card swipe (ClickUp Lz-33 / 869ff5gbw).
 *
 * 1:1 horizontal drag, token thresholds, no tilt / rotate / depth stack.
 * Timing and commit ratios come from `motion.*` tokens.
 * Reduced motion: cross-fade commits over `motion.reducedMotionCrossfadeMs` (no 8 px shift / slide-out).
 */

import { motion, spacing } from '@/theme/tokens';
import { REDUCED_MOTION_CROSSFADE_MS } from '@/lib/reducedMotion';

/** Re-export shared RM first-paint helpers (Lz-34). Prefer `@/lib/reducedMotion`. */
export {
  initialPrefersReducedMotion,
  readWebPrefersReducedMotion,
  resolveInitialReducedMotion,
} from '@/lib/reducedMotion';

/** |tx| / width at or above this commits (token: motion.swipeCommitRatio). */
export const SWIPE_COMMIT_RATIO = motion.swipeCommitRatio;

/** RNGH velocity is px/s; commit when |v|/1000 >= this (token: motion.swipeFlingPxPerMs). */
export const SWIPE_FLING_PX_PER_MS = motion.swipeFlingPxPerMs;

/** Non-commit spring-back duration (token: motion.swipeReturnMs). */
export const SWIPE_RETURN_MS = motion.swipeReturnMs;

/** Commit settle: fade + 8 px shift (token: motion.swipeSettleMs). */
export const SWIPE_SETTLE_MS = motion.swipeSettleMs;

/** Reduced-motion commit cross-fade (token: motion.reducedMotionCrossfadeMs). */
export const SWIPE_REDUCED_MOTION_CROSSFADE_MS = REDUCED_MOTION_CROSSFADE_MS;

/** Incoming-card shift distance (spacing step 8). */
export const SWIPE_ENTER_SHIFT_PX = spacing[1];

/**
 * Settled non-bouncy ease-out for return / settle / RM cross-fade.
 * Matches Reanimated `Easing.out(Easing.cubic)` (1 − (1−t)³) without importing
 * reanimated into this pure module (keeps `node:test` loadable).
 */
export function SWIPE_EASING(t: number): number {
  'worklet';
  const x = 1 - t;
  return 1 - x * x * x;
}

/** Commit exit / settle duration: RM cross-fade token, else settle token. */
export function swipeCommitDurationMs(reduceMotion: boolean): number {
  'worklet';
  return reduceMotion ? SWIPE_REDUCED_MOTION_CROSSFADE_MS : SWIPE_SETTLE_MS;
}

/**
 * Incoming-card enter shift. Under RM: 0 (cross-fade only).
 * Forward (left / vertical commit) uses +8; backtrack uses −8.
 */
export function swipeEnterShiftPx(reduceMotion: boolean, forward: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  return forward ? SWIPE_ENTER_SHIFT_PX : -SWIPE_ENTER_SHIFT_PX;
}

/** Under RM commits cross-fade in place — no slide-out translate. */
export function swipeShouldSlideOutOnCommit(reduceMotion: boolean): boolean {
  'worklet';
  return !reduceMotion;
}

/**
 * Commit direction on the pan axis: `-1` / `1`, or `0` when the gesture should return.
 * Distance commit wins when both distance and fling qualify; otherwise fling sign is used.
 *
 * Defined before `shouldCommitSwipe` so the worklet babel transform never closes over
 * a temporal-dead-zone binding (web: "Cannot access 'f' before initialization").
 */
export function swipeCommitDirection(
  translation: number,
  velocityPxPerS: number,
  cardExtent: number,
): -1 | 0 | 1 {
  'worklet';
  const extent = Math.max(1, cardExtent);
  const distanceCommit = Math.abs(translation) >= SWIPE_COMMIT_RATIO * extent;
  const flingCommit = Math.abs(velocityPxPerS) / 1000 >= SWIPE_FLING_PX_PER_MS;
  if (!distanceCommit && !flingCommit) return 0;
  if (distanceCommit) {
    if (translation < 0) return -1;
    if (translation > 0) return 1;
  }
  if (velocityPxPerS < 0) return -1;
  if (velocityPxPerS > 0) return 1;
  return 0;
}

/**
 * Commit when travel reaches the ratio of card extent, or fling speed hits the token.
 * `velocityPxPerS` is React Native Gesture Handler’s px/s unit.
 * JS-only helper for unit tests — not a worklet (avoids mutual worklet closure TDZ).
 */
export function shouldCommitSwipe(
  translation: number,
  velocityPxPerS: number,
  cardExtent: number,
): boolean {
  return swipeCommitDirection(translation, velocityPxPerS, cardExtent) !== 0;
}

/** Exclusive translate-only steps — no perspective / rotate keys. */
export type CardSwipeTransform = [{ translateX: number }, { translateY: number }];

export function cardSwipeFrontTransform(
  translateX: number,
  translateY: number,
): CardSwipeTransform {
  'worklet';
  return [{ translateX }, { translateY }];
}

export function cardSwipeReturnOverlayTransform(translateX: number): [{ translateX: number }] {
  'worklet';
  return [{ translateX }];
}

/** True when any step uses perspective or a rotate* key (forbidden in quiet swipe). */
export function cardSwipeTransformHasRotateOrPerspective(
  transform: ReadonlyArray<Record<string, unknown>>,
): boolean {
  for (const step of transform) {
    for (const key of Object.keys(step)) {
      if (key === 'perspective' || key.startsWith('rotate')) return true;
    }
  }
  return false;
}
