/**
 * Card flip motion (ClickUp Lz-56 / guide §17.3).
 *
 * Full motion: bidirectional rotateY 0→180 / 180→0 over `motion.flip.ms`.
 * Reduced motion: opacity cross-fade over `motion.reducedMotionCrossfadeMs`
 * (no perspective / rotate).
 *
 * Native snap note (cannot reproduce G1–G3 in cloud): previously each face
 * only rotated 90° (door) and `flipped` swapped pointerEvents + a11y at the
 * *start* of the reverse animation. Combined with an opacity cut at 0.48–0.52
 * while both faces were edge-on, back→front could read as a snap. This module
 * uses a 180° rotateY on both directions (front 0→180, back −180→0 so reverse
 * never wraps 360deg≡0deg) and exposes the AT face only after the midpoint
 * (`cardFlipA11yFace`). The 0–1 progress shared value lives on the stack so a
 * card remount cannot snap reverse to a flat front.
 */

import { motion } from '@/theme/tokens';
import { REDUCED_MOTION_CROSSFADE_MS } from '@/lib/reducedMotion';

/** Flip duration when motion is allowed (token: motion.flip.ms). */
export const FLIP_MS = motion.flip.ms;

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

/** Assistive-tech face after the midpoint (progress 0 = front, 1 = back). */
export function cardFlipA11yFace(progress: number): 'front' | 'back' {
  'worklet';
  return progress >= 0.5 ? 'back' : 'front';
}

export type CardFlipFaceStyle = {
  opacity: number;
  backfaceVisibility?: 'hidden' | 'visible';
  transform: Array<
    { perspective: number } | { rotateY: string } | { scale: number }
  >;
};

function flipFaceOpacity(progress: number, face: 'front' | 'back'): number {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  if (face === 'front') {
    return p < 0.48 ? 1 : p < 0.52 ? 1 - (p - 0.48) / 0.04 : 0;
  }
  return p < 0.48 ? 0 : p < 0.52 ? (p - 0.48) / 0.04 : 1;
}

/**
 * Front / back face presentation for a 0–1 flip progress.
 * Peek is already folded into `progress` by the caller.
 * Full motion: rotateY 0→180 (front) and −180→0 (back), both directions.
 * Back uses −180→0 rather than 180→360 so reverse does not wrap through
 * 360deg≡0deg (RN-web would snap the first reverse frame to a flat front).
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
  const opacity = flipFaceOpacity(p, face);
  if (face === 'front') {
    return {
      opacity,
      backfaceVisibility: 'hidden',
      transform: [{ perspective: 1200 }, { rotateY: `${180 * p}deg` }],
    };
  }
  return {
    opacity,
    backfaceVisibility: 'hidden',
    transform: [{ perspective: 1200 }, { rotateY: `${-180 + 180 * p}deg` }],
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
