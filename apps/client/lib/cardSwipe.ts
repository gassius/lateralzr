/**
 * Quiet-current deck swipe (ClickUp Lz-56 / guide §17.1–§17.5).
 *
 * Directional tilt + translation in four directions. Reduced motion is
 * translate-only (no rotate, perspective, scale, or lift).
 * Timing and angles come from `motion.swipe` / `motion.deck` tokens.
 */

import { motion, shadow, spacing } from '@/theme/tokens';
import { REDUCED_MOTION_CROSSFADE_MS } from '@/lib/reducedMotion';

/** Re-export shared RM first-paint helpers (Lz-34). Prefer `@/lib/reducedMotion`. */
export {
  initialPrefersReducedMotion,
  readWebPrefersReducedMotion,
  resolveInitialReducedMotion,
} from '@/lib/reducedMotion';

const swipe = motion.swipe;
const deck = motion.deck;

/** |tx| / extent at or above this commits (token: motion.swipe.commitRatio). */
export const SWIPE_COMMIT_RATIO = swipe.commitRatio;

/** RNGH velocity is px/s; commit when |v|/1000 >= this (token: motion.swipe.flingPxPerMs). */
export const SWIPE_FLING_PX_PER_MS = swipe.flingPxPerMs;

/** Commit exit duration (token: motion.swipe.exitMs). Alias of historical swipeSettleMs. */
export const SWIPE_SETTLE_MS = swipe.exitMs;

/** Historical return duration — full motion uses the spring below. */
export const SWIPE_RETURN_MS = motion.swipeReturnMs;

/** Reduced-motion commit cross-fade (token: motion.reducedMotionCrossfadeMs). */
export const SWIPE_REDUCED_MOTION_CROSSFADE_MS = REDUCED_MOTION_CROSSFADE_MS;

/** Incoming-card shift distance (spacing step 8) for loading-replace settle. */
export const SWIPE_ENTER_SHIFT_PX = spacing[1];

export const SWIPE_PERSPECTIVE = swipe.perspective;
export const SWIPE_TILT_Z_DEG_AT_HALF = swipe.tiltZDegAtHalf;
export const SWIPE_TILT_Z_DEG_MAX = swipe.tiltZDegMax;
export const SWIPE_TILT_Z_DEG_EXIT = swipe.tiltZDegExit;
export const SWIPE_TILT_Y_DEG_MAX = swipe.tiltYDegMax;
export const SWIPE_FOLLOW_Y_FACTOR = swipe.followYFactor;
export const SWIPE_LIFT_SHADOW_PX = swipe.liftShadowPx;
export const SWIPE_BACK_ENTER_TILT_Z_DEG = swipe.backEnterTiltZDeg;
export const SWIPE_BACK_ENTER_TILT_Y_DEG = swipe.backEnterTiltYDeg;
export const SWIPE_BACK_COVERED_SCALE = swipe.backCoveredScale;
export const SWIPE_BACK_COVERED_TINT = swipe.backCoveredTint;
export const SWIPE_VERTICAL_PITCH_DEG_MAX = swipe.verticalPitchDegMax;
export const SWIPE_VERTICAL_ROLL_DEG_MAX = swipe.verticalRollDegMax;
export const SWIPE_START_OF_HISTORY_RESISTANCE = swipe.startOfHistoryResistance;
export const SWIPE_BACK_FACE_SCROLL_HANDOFF_PX = swipe.backFaceScrollHandoffPx;

export const SWIPE_RETURN_SPRING = {
  damping: swipe.returnSpring.damping,
  stiffness: swipe.returnSpring.stiffness,
  overshootClamping: true as const,
};

export const DECK_UNDERLAYS = deck.underlays;
export const DECK_NEXT_VISIBLE_AT_REST = deck.nextVisibleAtRest;
export const DECK_NEXT_SCALE = deck.nextScale;
export const DECK_NEXT_OFFSET_Y = deck.nextOffsetY;
export const DECK_NEXT_TINT = deck.nextTint;
export const DECK_REVEAL_TO_SCALE = deck.revealToScale;
export const DECK_REVEAL_TINT = deck.revealTint;

/**
 * Park a hidden next-card underlay off-screen. Opacity 0 still composites
 * (and Playwright treats opacity-0 as visible); this matches the Lz-36 peek.
 */
export const DECK_UNDERLAY_HIDDEN_X = -4096;

/**
 * Settled non-bouncy ease-out for exit / settle / RM cross-fade.
 * Matches Reanimated `Easing.out(Easing.cubic)` (1 − (1−t)³) without importing
 * reanimated into this pure module (keeps `node:test` loadable).
 */
export function SWIPE_EASING(t: number): number {
  'worklet';
  const x = 1 - t;
  return 1 - x * x * x;
}

/** Commit exit / settle duration: RM cross-fade token, else exit token. */
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

export function shouldUseCardSwipe3d(reduceMotion: boolean): boolean {
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

function clampSigned(value: number, min: number, max: number): number {
  'worklet';
  const next = Math.max(min, Math.min(max, value));
  return next === 0 ? 0 : next;
}

function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

function deg(value: number): string {
  'worklet';
  const n = value === 0 ? 0 : value;
  return `${n}deg`;
}

/** Axis progress 0…1+ from travel vs card extent. */
export function swipeAxisProgress(translation: number, extent: number): number {
  'worklet';
  return Math.abs(translation) / Math.max(1, extent);
}

/**
 * Horizontal rotateZ while dragging: 8° at 50% width, max 12°.
 * Sign follows the swipe (left / negative tx → negative rotateZ).
 */
export function cardSwipeDragTiltZDeg(
  tx: number,
  width: number,
  reduceMotion: boolean,
): number {
  'worklet';
  if (reduceMotion || tx === 0) return 0;
  const p = swipeAxisProgress(tx, width);
  let mag: number;
  if (p <= 0.5) {
    mag = SWIPE_TILT_Z_DEG_AT_HALF * (p / 0.5);
  } else {
    mag = SWIPE_TILT_Z_DEG_AT_HALF + (SWIPE_TILT_Z_DEG_MAX - SWIPE_TILT_Z_DEG_AT_HALF) * Math.min(1, (p - 0.5) / 0.5);
  }
  mag = Math.min(mag, SWIPE_TILT_Z_DEG_MAX);
  const signed = tx < 0 ? -mag : mag;
  return signed === 0 ? 0 : signed;
}

/**
 * Left-exit rotateZ: lerp the release angle to −14° over exitProgress 0→1.
 * Right / Previous exits return 0 — the covered card stays flat; the incoming
 * overlay owns the −10° enter tilt.
 */
export function cardSwipeExitTiltZDeg(
  releaseTiltZDeg: number,
  exitProgress: number,
  exitSign: number,
): number {
  'worklet';
  const left = releaseTiltZDeg < 0 || exitSign < 0;
  if (!left) return 0;
  const p = clampSigned(exitProgress, 0, 1);
  const mag = lerp(Math.abs(releaseTiltZDeg), SWIPE_TILT_Z_DEG_EXIT, p);
  const signed = -mag;
  return signed === 0 ? 0 : signed;
}

/**
 * Horizontal rotateZ. `tx === 0` is always 0° (covered card / rest / right swipe).
 * Left exit (`exitProgress > 0` and tx ≠ 0 or exitSign < 0) ramps release → −14°.
 */
export function cardSwipeTiltZDeg(
  tx: number,
  width: number,
  reduceMotion: boolean,
  exitProgress: number = 0,
  releaseTiltZDeg: number = 0,
  exitSign: number = 0,
): number {
  'worklet';
  if (reduceMotion || tx === 0) return 0;
  if (exitProgress > 0) {
    return cardSwipeExitTiltZDeg(releaseTiltZDeg, exitProgress, exitSign);
  }
  return cardSwipeDragTiltZDeg(tx, width, reduceMotion);
}

/**
 * RM Next / Complexity fade the outgoing card (underlay is already opaque).
 * RM Previous keeps the covered card at 1 so a fading overlay cannot show shell.
 */
export function deckReducedMotionFadesOutgoingFront(
  direction: 'left' | 'right' | 'vertical',
): boolean {
  'worklet';
  return direction !== 'right';
}

/** Horizontal rotateY ≤ 3°, signed with travel. */
export function cardSwipeTiltYDeg(tx: number, width: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion || tx === 0) return 0;
  const p = Math.min(1, swipeAxisProgress(tx, width));
  const signed = (tx < 0 ? -1 : 1) * SWIPE_TILT_Y_DEG_MAX * p;
  return signed === 0 ? 0 : signed;
}

/** Vertical pitch (rotateX) ≤ 6°, mirrored for down. Swipe up (negative ty) tilts top away. */
export function cardSwipePitchDeg(ty: number, height: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion || ty === 0) return 0;
  const p = Math.min(1, swipeAxisProgress(ty, height));
  const signed = (-ty / Math.max(1, Math.abs(ty))) * SWIPE_VERTICAL_PITCH_DEG_MAX * p;
  return signed === 0 ? 0 : signed;
}

/** Vertical roll (rotateZ) ≤ 3°, mirrored for down. */
export function cardSwipeVerticalRollDeg(ty: number, height: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion || ty === 0) return 0;
  const p = Math.min(1, swipeAxisProgress(ty, height));
  const signed = (ty < 0 ? -1 : 1) * SWIPE_VERTICAL_ROLL_DEG_MAX * p;
  return signed === 0 ? 0 : signed;
}

/** Dampened finger-Y while dragging horizontally. RM stays axis-locked (no Y). */
export function cardSwipeFollowY(translationY: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  return translationY * SWIPE_FOLLOW_Y_FACTOR;
}

/** Right-swipe resistance at the start of history (0.35×). */
export function applyStartOfHistoryResistance(
  translationX: number,
  canGoBack: boolean,
): number {
  'worklet';
  if (canGoBack || translationX <= 0) return translationX;
  return translationX * SWIPE_START_OF_HISTORY_RESISTANCE;
}

/** Lift shadow extra offset, 0 at rest. */
export function cardSwipeLiftShadowPx(progress: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  return SWIPE_LIFT_SHADOW_PX * clampSigned(progress, 0, 1);
}

export type CardSwipeShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/**
 * Card lift shadow with full §23 tokens (color / opacity / radius / elevation).
 * Incomplete offset+elevation-only shadows render as a hard black bar on RN-web.
 */
export function cardSwipeLiftShadowStyle(liftPx: number): CardSwipeShadowStyle {
  'worklet';
  const lift = Math.max(0, liftPx);
  return {
    shadowColor: shadow.card.color,
    shadowOffset: {
      width: shadow.card.offsetWidth,
      height: shadow.card.offsetHeight + lift,
    },
    shadowOpacity: shadow.card.opacity,
    shadowRadius: shadow.card.radius,
    elevation: shadow.card.elevation + lift,
  };
}

/** Covered current card while the previous card enters on top. */
export function cardCoveredScale(coverProgress: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 1;
  return lerp(1, SWIPE_BACK_COVERED_SCALE, clampSigned(coverProgress, 0, 1));
}

export function cardCoveredTint(coverProgress: number): number {
  'worklet';
  return lerp(0, SWIPE_BACK_COVERED_TINT, clampSigned(coverProgress, 0, 1));
}

export function cardReturnOverlayTiltZDeg(progress: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  const p = clampSigned(progress, 0, 1);
  const value = SWIPE_BACK_ENTER_TILT_Z_DEG * (1 - p);
  return value === 0 ? 0 : value;
}

export function cardReturnOverlayTiltYDeg(progress: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return 0;
  const p = clampSigned(progress, 0, 1);
  const value = SWIPE_BACK_ENTER_TILT_Y_DEG * (1 - p);
  return value === 0 ? 0 : value;
}

export type DeckUnderlayReveal = {
  opacity: number;
  scale: number;
  offsetY: number;
  tint: number;
};

/**
 * Next-card underlay: hidden at rest unless `nextVisibleAtRest`.
 * Drag progress 0 → 1 rises scale 0.95 → 1, offset 10 → 0, tint 0.22 → 0.
 * Reduced motion keeps scale/offset at rest values (no scale motion).
 */
/**
 * Next-card underlay drag progress. Ignore vertical drift during a right
 * (back) swipe so the next card cannot show under the covered card.
 */
export function deckUnderlayDragProgress(
  translateX: number,
  translateY: number,
  width: number,
  height: number,
): number {
  'worklet';
  const leftP = translateX < 0 ? swipeAxisProgress(translateX, width) : 0;
  const vertP = translateX <= 0 ? swipeAxisProgress(translateY, height) : 0;
  return Math.max(leftP, vertP);
}

/**
 * RM commit zeros translate, so drag progress is 0. Reveal the incoming layer
 * from `peerCommitOpacity` (0→1 over the 150 ms cross-fade) instead.
 */
export function deckCommitCrossfadeProgress(
  dragProgress: number,
  peerCommitOpacity: number,
): number {
  'worklet';
  const drag = Math.max(0, dragProgress);
  const peer = Math.min(1, Math.max(0, peerCommitOpacity));
  return Math.max(drag, peer);
}

export function deckUnderlayReveal(
  dragProgress: number,
  reduceMotion: boolean,
  nextVisibleAtRest: boolean = DECK_NEXT_VISIBLE_AT_REST,
): DeckUnderlayReveal {
  'worklet';
  const p = clampSigned(dragProgress, 0, 1);
  const visible = nextVisibleAtRest || p > 0;
  if (!visible) {
    return { opacity: 0, scale: DECK_NEXT_SCALE, offsetY: DECK_NEXT_OFFSET_Y, tint: DECK_NEXT_TINT };
  }
  if (reduceMotion) {
    return { opacity: 1, scale: 1, offsetY: 0, tint: DECK_NEXT_TINT * (1 - p) };
  }
  return {
    opacity: 1,
    scale: lerp(DECK_NEXT_SCALE, DECK_REVEAL_TO_SCALE, p),
    offsetY: lerp(DECK_NEXT_OFFSET_Y, 0, p),
    tint: lerp(DECK_NEXT_TINT, DECK_REVEAL_TINT, p),
  };
}

/**
 * Back-face vertical hand-off origin in touch-down coordinates.
 *
 * `edgeTranslationY` is `edgeStartY − touchStartY`, latched the first time
 * the scroll sits at the relevant edge during this touch. Activate only after
 * `handoffPx` past that latch. Origin is `(edgeStartY − touchStartY) ± 24`
 * so a 200 px scroll plus 30 px past the edge yields ~6 px of card travel,
 * not the full finger delta from touch-down.
 */
export function backFaceVerticalHandoffOrigin(
  translationY: number,
  edgeTranslationY: number,
  atTop: boolean,
  atBottom: boolean,
  handoffPx: number = SWIPE_BACK_FACE_SCROLL_HANDOFF_PX,
): number | null {
  'worklet';
  const pastEdge = translationY - edgeTranslationY;
  if (atBottom && pastEdge < -handoffPx) return edgeTranslationY - handoffPx;
  if (atTop && pastEdge > handoffPx) return edgeTranslationY + handoffPx;
  return null;
}

export function cardSwipeTranslationAfterHandoff(translation: number, origin: number): number {
  'worklet';
  return translation - origin;
}

export type CardSwipeTransformStep =
  | { perspective: number }
  | { translateX: number }
  | { translateY: number }
  | { rotateX: string }
  | { rotateY: string }
  | { rotateZ: string }
  | { scale: number };

export type CardSwipeTransform = CardSwipeTransformStep[];

function bottomCenterPivot(
  translateX: number,
  translateY: number,
  height: number,
  rotateXDeg: number,
  rotateYDeg: number,
  rotateZDeg: number,
): CardSwipeTransform {
  'worklet';
  return [
    { perspective: SWIPE_PERSPECTIVE },
    { translateX },
    { translateY },
    { translateY: height / 2 },
    { rotateX: deg(rotateXDeg) },
    { rotateY: deg(rotateYDeg) },
    { rotateZ: deg(rotateZDeg) },
    { translateY: -height / 2 },
  ];
}

function centerPivot(
  translateX: number,
  translateY: number,
  rotateXDeg: number,
  rotateYDeg: number,
  rotateZDeg: number,
): CardSwipeTransform {
  'worklet';
  return [
    { perspective: SWIPE_PERSPECTIVE },
    { translateX },
    { translateY },
    { rotateX: deg(rotateXDeg) },
    { rotateY: deg(rotateYDeg) },
    { rotateZ: deg(rotateZDeg) },
  ];
}

/**
 * Front-card swipe transform. Horizontal uses the bottom-centre pivot;
 * vertical uses the card centre. Reduced motion is translate-only.
 */
export function cardSwipeFrontTransform(
  translateX: number,
  translateY: number,
  width: number,
  height: number,
  reduceMotion: boolean,
  exitProgress: number = 0,
  releaseTiltZDeg: number = 0,
  exitSign: number = 0,
): CardSwipeTransform {
  'worklet';
  if (!shouldUseCardSwipe3d(reduceMotion)) {
    return [{ translateX }, { translateY }];
  }
  const horizontal = Math.abs(translateX) >= Math.abs(translateY);
  if (horizontal) {
    const tiltZ = cardSwipeTiltZDeg(
      translateX,
      width,
      reduceMotion,
      exitProgress,
      releaseTiltZDeg,
      exitSign,
    );
    const tiltY = cardSwipeTiltYDeg(translateX, width, reduceMotion);
    return bottomCenterPivot(translateX, translateY, height, 0, tiltY, tiltZ);
  }
  const pitch = cardSwipePitchDeg(translateY, height, reduceMotion);
  const roll = cardSwipeVerticalRollDeg(translateY, height, reduceMotion);
  return centerPivot(translateX, translateY, pitch, 0, roll);
}

/** Previous-card overlay entering from the left (starts −10° Z / −3° Y). */
export function cardSwipeReturnOverlayTransform(
  translateX: number,
  height: number,
  progress: number,
  reduceMotion: boolean,
): CardSwipeTransform {
  'worklet';
  if (!shouldUseCardSwipe3d(reduceMotion)) {
    return [{ translateX }];
  }
  const tiltZ = cardReturnOverlayTiltZDeg(progress, reduceMotion);
  const tiltY = cardReturnOverlayTiltYDeg(progress, reduceMotion);
  return bottomCenterPivot(translateX, 0, height, 0, tiltY, tiltZ);
}

export function deckUnderlayTransform(
  scale: number,
  offsetY: number,
  reduceMotion: boolean,
  hidden: boolean = false,
): CardSwipeTransform {
  'worklet';
  if (hidden) {
    return [{ translateX: DECK_UNDERLAY_HIDDEN_X }];
  }
  if (reduceMotion) {
    return [{ translateY: 0 }, { scale: 1 }];
  }
  return [{ translateY: offsetY }, { scale }];
}

/**
 * Opacity 0 still has a bounding box (Playwright `visible=true`, RN-web
 * compositor flash). Pair it with CSS `visibility: hidden` while parked.
 */
export function deckLayerVisibility(hidden: boolean): 'hidden' | 'visible' {
  'worklet';
  return hidden ? 'hidden' : 'visible';
}

/** True when any step uses perspective or a rotate* key (forbidden under RM). */
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
