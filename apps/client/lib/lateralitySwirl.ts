/**
 * Calm deck-swirl poses for laterality neighborhood reloads.
 *
 * Motion math stays here so tests can lock the “shuffle, not spinner” language
 * without mounting Reanimated. The overlay covers fetch + swap, then settles
 * onto the (unchanged) current card.
 */

export const LATERALITY_SWIRL_CARD_COUNT = 5;
export const LATERALITY_SWIRL_REDUCED_CARD_COUNT = 3;
export const LATERALITY_SWIRL_PERIOD_MS = 2600;
export const LATERALITY_SWIRL_MIN_MS = 720;
export const LATERALITY_SWIRL_FAILURE_MIN_MS = 220;
export const LATERALITY_SWIRL_REDUCED_HOLD_MS = 160;
export const LATERALITY_SWIRL_SETTLE_MS = 380;
export const LATERALITY_SWIRL_APPEAR_MS = 140;
export const LATERALITY_SWIRL_CARD_SIZE = 0.54;
export const LATERALITY_SWIRL_RADIUS_RATIO = 0.2;
export const LATERALITY_SWIRL_FAN_SPREAD_RATIO = 0.09;
export const LATERALITY_SWIRL_MAX_TILT_DEG = 18;

export type LateralitySwirlOutcome = 'pending' | 'success' | 'failure';

export type LateralitySwirlPose = {
  x: number;
  y: number;
  rotateDeg: number;
  scale: number;
  zIndex: number;
};

export function shouldAnimateLateralitySwirl(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

export function lateralitySwirlCardCount(reduceMotion: boolean): number {
  return reduceMotion ? LATERALITY_SWIRL_REDUCED_CARD_COUNT : LATERALITY_SWIRL_CARD_COUNT;
}

export function lateralitySwirlHoldMs(
  outcome: Exclude<LateralitySwirlOutcome, 'pending'>,
  elapsedMs: number,
  animate: boolean,
): number {
  if (!animate) {
    return Math.max(0, LATERALITY_SWIRL_REDUCED_HOLD_MS - elapsedMs);
  }
  const min = outcome === 'success' ? LATERALITY_SWIRL_MIN_MS : LATERALITY_SWIRL_FAILURE_MIN_MS;
  return Math.max(0, min - elapsedMs);
}

export function lateralitySwirlAngle(progress: number, index: number, count: number): number {
  'worklet';
  const n = count > 0 ? count : 1;
  return (index / n) * Math.PI * 2 + progress * Math.PI * 2;
}

export function lateralitySwirlCardPose(
  progress: number,
  index: number,
  radius: number,
  count: number = LATERALITY_SWIRL_CARD_COUNT,
): LateralitySwirlPose {
  'worklet';
  const angle = lateralitySwirlAngle(progress, index, count);
  const depth = (Math.sin(angle) + 1) / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.62,
    rotateDeg: Math.cos(angle) * LATERALITY_SWIRL_MAX_TILT_DEG,
    scale: 0.84 + depth * 0.16,
    zIndex: Math.round(depth * 20),
  };
}

/** Still fan — laterality is changing, but nothing orbits. */
export function lateralitySwirlStaticPose(
  index: number,
  count: number,
  spread: number,
): LateralitySwirlPose {
  const mid = (count - 1) / 2;
  const t = index - mid;
  return {
    x: t * spread,
    y: Math.abs(t) * 6,
    rotateDeg: t * 9,
    scale: 1 - Math.abs(t) * 0.035,
    zIndex: count - Math.abs(Math.round(t)),
  };
}

function signedZero(value: number): number {
  'worklet';
  return value === 0 ? 0 : value;
}

export function lateralitySwirlSettledPose(
  pose: LateralitySwirlPose,
  settle: number,
): LateralitySwirlPose & { opacity: number } {
  'worklet';
  const p = Math.max(0, Math.min(1, settle));
  return {
    x: signedZero(pose.x * (1 - p)),
    y: signedZero(pose.y * (1 - p)),
    rotateDeg: signedZero(pose.rotateDeg * (1 - p)),
    scale: pose.scale + (1 - pose.scale) * p,
    zIndex: pose.zIndex,
    opacity: 1 - p,
  };
}

export function lateralitySwirlOverlayOpacity(appear: number, settle: number): number {
  'worklet';
  return Math.max(0, Math.min(1, appear)) * (1 - Math.max(0, Math.min(1, settle)));
}
