/**
 * Deck swipe motion tokens (ClickUp 869f640bd).
 *
 * Horizontal roll already exists; vertical travel was a flat slide. Depth is a
 * slightly darker rear card plus a mild pitch and a hint of rotateY — tactile,
 * not arcade. Reduced motion is translate-only (no compulsory 3D).
 */

/** Matches ConceptCard flip perspective so wrapper and face 3D share a family. */
export const CARD_SWIPE_PERSPECTIVE = 1200;

/** Existing left-swipe roll around the bottom-center pivot. */
export const CARD_SWIPE_MAX_ROLL_DEG = 45;

/** Backward-enter / return-overlay roll that settles to 0. */
export const CARD_SWIPE_ENTER_ROLL_DEG = 14;

/** Mild pitch on the vertical travel axis. */
export const CARD_SWIPE_MAX_PITCH_DEG = 9;

/** Mild roll that travels with swipe up/down so tilt reads in the phone frame. */
export const CARD_SWIPE_MAX_VERTICAL_ROLL_DEG = 6;

/** Subtle Y-axis depth across swipe / enter / return. */
export const CARD_SWIPE_MAX_YAW_DEG = 4.5;

/**
 * Dark-blue stack tint. Stronger than the previous 0.10 so the rear card
 * reads as underneath without looking like a different card.
 */
export const CARD_STACK_BEHIND_TINT_ALPHA = 0.22;

export const CARD_STACK_BEHIND_TINT = 'rgba(19,91,119,0.22)';

/** Previous overlay — kept for tests so the contrast upgrade stays explicit. */
export const CARD_STACK_BEHIND_TINT_ALPHA_LEGACY = 0.1;

export function shouldUseCardSwipe3d(reduceMotion: boolean): boolean {
  'worklet';
  return !reduceMotion;
}

export function initialPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  const next = Math.max(min, Math.min(max, value));
  // Avoid -0 so settle writes `0deg` rather than `-0deg`.
  return next === 0 ? 0 : next;
}

/** Roll for the front card: left travel only, same formula as the previous deck. */
export function cardSwipeRollDeg(tx: number, width: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion || tx >= 0) return 0;
  const half = Math.max(1, width / 2);
  return clamp((tx / half) * CARD_SWIPE_MAX_ROLL_DEG, -CARD_SWIPE_MAX_ROLL_DEG, CARD_SWIPE_MAX_ROLL_DEG);
}

/**
 * Pitch for vertical travel. Swipe up (negative ty) tilts the top away;
 * swipe down is the opposite. Settles to 0 with ty.
 */
export function cardSwipePitchDeg(ty: number, height: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  const half = Math.max(1, height / 2);
  return clamp((-ty / half) * CARD_SWIPE_MAX_PITCH_DEG, -CARD_SWIPE_MAX_PITCH_DEG, CARD_SWIPE_MAX_PITCH_DEG);
}

/** Small roll on the vertical travel axis. Settles to 0 with ty. */
export function cardSwipeVerticalRollDeg(ty: number, height: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  const half = Math.max(1, height / 2);
  return clamp(
    (ty / half) * CARD_SWIPE_MAX_VERTICAL_ROLL_DEG,
    -CARD_SWIPE_MAX_VERTICAL_ROLL_DEG,
    CARD_SWIPE_MAX_VERTICAL_ROLL_DEG,
  );
}

/**
 * Subtle rotateY. Horizontal travel leads; vertical adds a smaller lean.
 * `extraRollDeg` (enter / return) contributes a matching hint so settle stays flat.
 */
export function cardSwipeYawDeg(
  tx: number,
  ty: number,
  width: number,
  height: number,
  extraRollDeg: number,
  reduceMotion: boolean,
): number {
  'worklet';
  if (reduceMotion) return 0;
  const yawFromX = (tx / Math.max(1, width / 2)) * CARD_SWIPE_MAX_YAW_DEG;
  const yawFromY = (ty / Math.max(1, height / 2)) * (CARD_SWIPE_MAX_YAW_DEG * 0.65);
  const yawFromEnter = (extraRollDeg / CARD_SWIPE_ENTER_ROLL_DEG) * CARD_SWIPE_MAX_YAW_DEG;
  return clamp(yawFromX + yawFromY + yawFromEnter, -CARD_SWIPE_MAX_YAW_DEG, CARD_SWIPE_MAX_YAW_DEG);
}

export function cardReturnOverlayRollDeg(progress: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  const p = clamp(progress, 0, 1);
  return clamp(-CARD_SWIPE_ENTER_ROLL_DEG * (1 - p), -CARD_SWIPE_ENTER_ROLL_DEG, CARD_SWIPE_ENTER_ROLL_DEG);
}

export function cardReturnOverlayYawDeg(progress: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  const p = clamp(progress, 0, 1);
  return clamp(-CARD_SWIPE_MAX_YAW_DEG * (1 - p), -CARD_SWIPE_MAX_YAW_DEG, CARD_SWIPE_MAX_YAW_DEG);
}

/** Front card dims as the return overlay covers it (same tint family as the rear stack). */
export function cardCoverDimOpacity(coverProgress: number): number {
  'worklet';
  return clamp(coverProgress, 0, 1);
}
