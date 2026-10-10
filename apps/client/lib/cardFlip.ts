/**
 * Card flip motion (ClickUp Lz-34 / 869ff5gcb).
 *
 * Full motion: 3D rotateY over `motion.flipMs` with settled ease-out.
 * Reduced motion: opacity cross-fade over `motion.reducedMotionCrossfadeMs`
 * (no perspective / rotate).
 */

import { motion } from '@/theme/tokens';
import { REDUCED_MOTION_CROSSFADE_MS } from '@/lib/reducedMotion';

/** Flip duration when motion is allowed (token: motion.flipMs). */
export const FLIP_MS = motion.flipMs;

/** RM face cross-fade (token: motion.reducedMotionCrossfadeMs). */
export const FLIP_REDUCED_MOTION_CROSSFADE_MS = REDUCED_MOTION_CROSSFADE_MS;

/** Settled ease-out cubic — matches Reanimated `Easing.out(Easing.cubic)`. */
export function FLIP_EASING(t: number): number {
  'worklet';
  const x = 1 - t;
  return 1 - x * x * x;
}

export function flipDurationMs(reduceMotion: boolean): number {
  'worklet';
  return reduceMotion ? FLIP_REDUCED_MOTION_CROSSFADE_MS : FLIP_MS;
}

/** Under RM faces switch by opacity only — no 3D rotate. */
export function flipUses3d(reduceMotion: boolean): boolean {
  'worklet';
  return !reduceMotion;
}

export type CardFlipFaceStyle = {
  opacity: number;
  transform: Array<
    { perspective: number } | { rotateY: string } | { scale: number }
  >;
};

/**
 * Front / back face presentation for a 0–1 flip progress.
 * Peek is already folded into `progress` by the caller.
 */
export function cardFlipFaceStyle(
  progress: number,
  face: 'front' | 'back',
  reduceMotion: boolean,
): CardFlipFaceStyle {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  if (reduceMotion) {
    // Front (zIndex 2) fades; back stays fully opaque once progress > 0 so the
    // navy shell never shows through (AD: no mid-crossfade dim).
    // At rest, scale(0) collapses the hidden face's box — without rotateY the
    // faded face otherwise keeps a full layout box that Playwright still treats
    // as visible despite opacity 0 (Lz-27 scroll / no-flip asserts).
    if (face === 'front') {
      const opacity = 1 - p;
      return { opacity, transform: opacity <= 0 ? [{ scale: 0 }] : [] };
    }
    const opacity = p > 0 ? 1 : 0;
    return { opacity, transform: opacity <= 0 ? [{ scale: 0 }] : [] };
  }
  if (face === 'front') {
    const rot = -90 * p;
    return {
      opacity: p < 0.48 ? 1 : p < 0.52 ? 1 - (p - 0.48) / 0.04 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${rot}deg` }],
    };
  }
  const rot = 90 * (1 - p);
  return {
    opacity: p < 0.48 ? 0 : p < 0.52 ? (p - 0.48) / 0.04 : 1,
    transform: [{ perspective: 1200 }, { rotateY: `${rot}deg` }],
  };
}

/** True when any step uses perspective or a rotate* key (forbidden under RM). */
export function cardFlipTransformHasRotateOrPerspective(
  transform: ReadonlyArray<Record<string, unknown>>,
): boolean {
  for (const step of transform) {
    for (const key of Object.keys(step)) {
      if (key === 'perspective' || key.startsWith('rotate')) return true;
    }
  }
  return false;
}
