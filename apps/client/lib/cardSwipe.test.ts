import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DECK_NEXT_OFFSET_Y,
  DECK_NEXT_SCALE,
  DECK_NEXT_TINT,
  DECK_NEXT_VISIBLE_AT_REST,
  DECK_UNDERLAY_HIDDEN_X,
  DECK_UNDERLAYS,
  SWIPE_BACK_COVERED_SCALE,
  SWIPE_BACK_COVERED_TINT,
  SWIPE_BACK_ENTER_TILT_Y_DEG,
  SWIPE_BACK_ENTER_TILT_Z_DEG,
  SWIPE_BACK_FACE_SCROLL_HANDOFF_PX,
  SWIPE_COMMIT_RATIO,
  SWIPE_EASING,
  SWIPE_ENTER_SHIFT_PX,
  SWIPE_FLING_PX_PER_MS,
  SWIPE_FOLLOW_Y_FACTOR,
  SWIPE_LIFT_SHADOW_PX,
  SWIPE_PERSPECTIVE,
  SWIPE_REDUCED_MOTION_CROSSFADE_MS,
  SWIPE_RETURN_SPRING,
  SWIPE_SETTLE_MS,
  SWIPE_START_OF_HISTORY_RESISTANCE,
  SWIPE_TILT_Y_DEG_MAX,
  SWIPE_TILT_Z_DEG_AT_HALF,
  SWIPE_TILT_Z_DEG_EXIT,
  SWIPE_TILT_Z_DEG_MAX,
  SWIPE_VERTICAL_PITCH_DEG_MAX,
  SWIPE_VERTICAL_ROLL_DEG_MAX,
  applyStartOfHistoryResistance,
  backFaceVerticalHandoffOrigin,
  cardCoveredScale,
  cardCoveredTint,
  cardReturnOverlayTiltYDeg,
  cardReturnOverlayTiltZDeg,
  cardSwipeFollowY,
  cardSwipeFrontTransform,
  cardSwipeLiftShadowPx,
  cardSwipePitchDeg,
  cardSwipeReturnOverlayTransform,
  cardSwipeTiltYDeg,
  cardSwipeTiltZDeg,
  cardSwipeTransformHasRotateOrPerspective,
  cardSwipeTranslationAfterHandoff,
  cardSwipeVerticalRollDeg,
  deckLayerVisibility,
  deckUnderlayReveal,
  deckUnderlayTransform,
  initialPrefersReducedMotion,
  resolveInitialReducedMotion,
  shouldCommitSwipe,
  shouldUseCardSwipe3d,
  swipeCommitDirection,
  swipeCommitDurationMs,
  swipeEnterShiftPx,
  swipeShouldSlideOutOnCommit,
} from './cardSwipe.ts';
import { motion, spacing } from '../theme/tokens.ts';

const CARD_W = 360;
const CARD_H = 500;

describe('swipe motion tokens', () => {
  it('pins commit / fling / exit / spring / RM from motion.swipe + deck', () => {
    assert.equal(SWIPE_COMMIT_RATIO, motion.swipe.commitRatio);
    assert.equal(SWIPE_COMMIT_RATIO, 0.3);
    assert.equal(SWIPE_FLING_PX_PER_MS, motion.swipe.flingPxPerMs);
    assert.equal(SWIPE_FLING_PX_PER_MS, 0.5);
    assert.equal(SWIPE_SETTLE_MS, motion.swipe.exitMs);
    assert.equal(SWIPE_SETTLE_MS, 260);
    assert.equal(SWIPE_SETTLE_MS, motion.swipeSettleMs);
    assert.equal(SWIPE_REDUCED_MOTION_CROSSFADE_MS, motion.reducedMotionCrossfadeMs);
    assert.equal(SWIPE_REDUCED_MOTION_CROSSFADE_MS, 150);
    assert.equal(SWIPE_ENTER_SHIFT_PX, spacing[1]);
    assert.equal(SWIPE_RETURN_SPRING.damping, 26);
    assert.equal(SWIPE_RETURN_SPRING.stiffness, 260);
    assert.equal(SWIPE_RETURN_SPRING.overshootClamping, true);
    assert.equal(SWIPE_PERSPECTIVE, 1200);
    assert.equal(SWIPE_TILT_Z_DEG_AT_HALF, 8);
    assert.equal(SWIPE_TILT_Z_DEG_MAX, 12);
    assert.equal(SWIPE_TILT_Z_DEG_EXIT, 14);
    assert.equal(SWIPE_TILT_Y_DEG_MAX, 3);
    assert.equal(SWIPE_FOLLOW_Y_FACTOR, 0.15);
    assert.equal(SWIPE_LIFT_SHADOW_PX, 6);
    assert.equal(SWIPE_BACK_ENTER_TILT_Z_DEG, -10);
    assert.equal(SWIPE_BACK_ENTER_TILT_Y_DEG, -3);
    assert.equal(SWIPE_BACK_COVERED_SCALE, 0.97);
    assert.equal(SWIPE_BACK_COVERED_TINT, 0.22);
    assert.equal(SWIPE_VERTICAL_PITCH_DEG_MAX, 6);
    assert.equal(SWIPE_VERTICAL_ROLL_DEG_MAX, 3);
    assert.equal(SWIPE_START_OF_HISTORY_RESISTANCE, 0.35);
    assert.equal(SWIPE_BACK_FACE_SCROLL_HANDOFF_PX, 24);
    assert.equal(DECK_UNDERLAYS, 1);
    assert.equal(DECK_NEXT_VISIBLE_AT_REST, false);
    assert.equal(DECK_NEXT_SCALE, 0.95);
    assert.equal(DECK_NEXT_OFFSET_Y, 10);
    assert.equal(DECK_NEXT_TINT, 0.22);
  });
});

describe('shouldCommitSwipe', () => {
  it('does not commit at 29% of card width', () => {
    assert.equal(shouldCommitSwipe(0.29 * CARD_W, 0, CARD_W), false);
    assert.equal(shouldCommitSwipe(-0.29 * CARD_W, 0, CARD_W), false);
  });

  it('commits at 30% of card width', () => {
    assert.equal(shouldCommitSwipe(0.3 * CARD_W, 0, CARD_W), true);
    assert.equal(shouldCommitSwipe(-0.3 * CARD_W, 0, CARD_W), true);
  });

  it('does not commit at 499 px/s fling', () => {
    assert.equal(shouldCommitSwipe(0, 499, CARD_W), false);
    assert.equal(shouldCommitSwipe(0, -499, CARD_W), false);
  });

  it('commits at 500 px/s fling (0.5 px/ms)', () => {
    assert.equal(shouldCommitSwipe(0, 500, CARD_W), true);
    assert.equal(shouldCommitSwipe(0, -500, CARD_W), true);
  });

  it('resolves commit direction from distance, then fling sign', () => {
    assert.equal(swipeCommitDirection(-0.3 * CARD_W, 0, CARD_W), -1);
    assert.equal(swipeCommitDirection(0.3 * CARD_W, 0, CARD_W), 1);
    assert.equal(swipeCommitDirection(0, -500, CARD_W), -1);
    assert.equal(swipeCommitDirection(0, 500, CARD_W), 1);
    assert.equal(swipeCommitDirection(0, 0, CARD_W), 0);
  });
});

describe('directional tilt transforms', () => {
  it('is exactly 0 at rest (no rotate / perspective)', () => {
    assert.equal(cardSwipeTiltZDeg(0, CARD_W, false, false), 0);
    assert.equal(cardSwipeTiltYDeg(0, CARD_W, false), 0);
    assert.equal(cardSwipePitchDeg(0, CARD_H, false), 0);
    assert.equal(cardSwipeVerticalRollDeg(0, CARD_H, false), 0);
    const rest = cardSwipeFrontTransform(0, 0, CARD_W, CARD_H, false);
    const z = rest.find((s) => 'rotateZ' in s) as { rotateZ: string } | undefined;
    const y = rest.find((s) => 'rotateY' in s) as { rotateY: string } | undefined;
    const x = rest.find((s) => 'rotateX' in s) as { rotateX: string } | undefined;
    assert.equal(z?.rotateZ, '0deg');
    assert.equal(y?.rotateY, '0deg');
    assert.equal(x?.rotateX, '0deg');
  });

  it('left swipe: 8° rotateZ at 50% width, max 12°, exit 14°, rotateY ≤ 3°', () => {
    assert.equal(cardSwipeTiltZDeg(-0.5 * CARD_W, CARD_W, false, false), -8);
    assert.equal(cardSwipeTiltZDeg(-CARD_W, CARD_W, false, false), -12);
    assert.equal(cardSwipeTiltZDeg(-CARD_W, CARD_W, true, false), -14);
    const yaw = cardSwipeTiltYDeg(-CARD_W, CARD_W, false);
    assert.ok(Math.abs(yaw) <= 3);
    assert.ok(yaw < 0);
  });

  it('right overlay starts at −10° Z and −3° Y and settles to 0', () => {
    assert.equal(cardReturnOverlayTiltZDeg(0, false), -10);
    assert.equal(cardReturnOverlayTiltYDeg(0, false), -3);
    assert.equal(cardReturnOverlayTiltZDeg(1, false), 0);
    assert.equal(cardReturnOverlayTiltYDeg(1, false), 0);
  });

  it('vertical pitch ≤ 6° and roll ≤ 3°, mirrored for down', () => {
    assert.equal(cardSwipePitchDeg(-CARD_H, CARD_H, false), 6);
    assert.equal(cardSwipePitchDeg(CARD_H, CARD_H, false), -6);
    assert.equal(cardSwipeVerticalRollDeg(-CARD_H, CARD_H, false), -3);
    assert.equal(cardSwipeVerticalRollDeg(CARD_H, CARD_H, false), 3);
  });

  it('full motion front transform uses perspective and rotate keys', () => {
    const left = cardSwipeFrontTransform(-80, 0, CARD_W, CARD_H, false);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(left), true);
    assert.ok(left.some((s) => 'perspective' in s && s.perspective === 1200));
    assert.ok(left.some((s) => 'rotateZ' in s));
    const overlay = cardSwipeReturnOverlayTransform(-CARD_W * 0.4, CARD_H, 0.2, false);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(overlay), true);
  });

  it('covered card scales to 0.97 and tints to 0.22', () => {
    assert.equal(cardCoveredScale(0, false), 1);
    assert.equal(cardCoveredScale(1, false), 0.97);
    assert.equal(cardCoveredTint(0), 0);
    assert.equal(cardCoveredTint(1), 0.22);
    assert.equal(cardCoveredScale(1, true), 1);
  });

  it('lift shadow is 6 px at full progress and 0 under RM / rest', () => {
    assert.equal(cardSwipeLiftShadowPx(0, false), 0);
    assert.equal(cardSwipeLiftShadowPx(1, false), 6);
    assert.equal(cardSwipeLiftShadowPx(1, true), 0);
  });
});

describe('start-of-history resistance', () => {
  it('applies 0.35× to right travel when history cannot go back', () => {
    assert.equal(applyStartOfHistoryResistance(100, false), 35);
    assert.equal(applyStartOfHistoryResistance(100, true), 100);
    assert.equal(applyStartOfHistoryResistance(-80, false), -80);
  });
});

describe('deck underlay', () => {
  it('is hidden at rest when nextVisibleAtRest is false', () => {
    const rest = deckUnderlayReveal(0, false, false);
    assert.equal(rest.opacity, 0);
    assert.equal(rest.scale, 0.95);
    assert.equal(rest.offsetY, 10);
    assert.equal(rest.tint, 0.22);
  });

  it('rises to scale 1 / offset 0 / tint 0 as drag progresses', () => {
    const mid = deckUnderlayReveal(0.5, false, false);
    assert.equal(mid.opacity, 1);
    assert.ok(mid.scale > 0.95 && mid.scale < 1);
    assert.ok(mid.offsetY > 0 && mid.offsetY < 10);
    const end = deckUnderlayReveal(1, false, false);
    assert.equal(end.scale, 1);
    assert.equal(end.offsetY, 0);
    assert.equal(end.tint, 0);
  });

  it('RM underlay has no scale / offset change', () => {
    const rm = deckUnderlayReveal(0.8, true, false);
    assert.equal(rm.opacity, 1);
    assert.equal(rm.scale, 1);
    assert.equal(rm.offsetY, 0);
    const xf = deckUnderlayTransform(rm.scale, rm.offsetY, true);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(xf), false);
    assert.deepEqual(xf, [{ translateY: 0 }, { scale: 1 }]);
  });

  it('parks a hidden underlay off-screen so opacity 0 is not hit-test visible', () => {
    const rest = deckUnderlayReveal(0, false, false);
    const xf = deckUnderlayTransform(rest.scale, rest.offsetY, false, rest.opacity <= 0);
    assert.deepEqual(xf, [{ translateX: DECK_UNDERLAY_HIDDEN_X }]);
    assert.equal(deckLayerVisibility(true), 'hidden');
    assert.equal(deckLayerVisibility(false), 'visible');
  });
});

describe('back-face scroll hand-off', () => {
  it('hands off after 24 px past the latched scroll edge, not from touch-down', () => {
    // Already at the edge: latch is 0 (edgeStartY === touchStartY).
    assert.equal(backFaceVerticalHandoffOrigin(-24, 0, false, true), null);
    assert.equal(backFaceVerticalHandoffOrigin(-25, 0, false, true), -24);
    assert.equal(backFaceVerticalHandoffOrigin(25, 0, true, false), 24);
    assert.equal(backFaceVerticalHandoffOrigin(-80, 0, true, false), null);
    assert.equal(cardSwipeTranslationAfterHandoff(-80, -24), -56);
  });

  it('200 px of scroll then 30 px past the edge yields ~6 px of card travel', () => {
    const edgeTranslationY = -200;
    const translationY = -230;
    const origin = backFaceVerticalHandoffOrigin(translationY, edgeTranslationY, false, true);
    assert.equal(origin, -224);
    assert.equal(cardSwipeTranslationAfterHandoff(translationY, origin!), -6);
  });
});

describe('reduced-motion swipe commit branch', () => {
  it('uses 150 ms cross-fade, no enter shift, no slide-out, no 3D', () => {
    assert.equal(swipeCommitDurationMs(true), SWIPE_REDUCED_MOTION_CROSSFADE_MS);
    assert.equal(swipeCommitDurationMs(true), 150);
    assert.equal(swipeEnterShiftPx(true, true), 0);
    assert.equal(swipeEnterShiftPx(true, false), 0);
    assert.equal(swipeShouldSlideOutOnCommit(true), false);
    assert.equal(shouldUseCardSwipe3d(true), false);
    const front = cardSwipeFrontTransform(-80, -120, CARD_W, CARD_H, true);
    const ret = cardSwipeReturnOverlayTransform(-CARD_W * 0.4, CARD_H, 0.4, true);
    assert.deepEqual(front, [{ translateX: -80 }, { translateY: -120 }]);
    assert.deepEqual(ret, [{ translateX: -CARD_W * 0.4 }]);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(front), false);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(ret), false);
    assert.equal(cardSwipeTiltZDeg(-180, CARD_W, true, true), 0);
    assert.equal(cardSwipePitchDeg(-200, CARD_H, true), 0);
    assert.equal(cardSwipeFollowY(40, true), 40);
  });

  it('keeps settle timing / ±8 shift / slide-out when RM is off', () => {
    assert.equal(swipeCommitDurationMs(false), SWIPE_SETTLE_MS);
    assert.equal(swipeEnterShiftPx(false, true), SWIPE_ENTER_SHIFT_PX);
    assert.equal(swipeEnterShiftPx(false, false), -SWIPE_ENTER_SHIFT_PX);
    assert.equal(swipeShouldSlideOutOnCommit(false), true);
    assert.equal(cardSwipeFollowY(40, false), 6);
  });

  it('SWIPE_EASING is cubic ease-out (matches Easing.out(Easing.cubic))', () => {
    assert.equal(SWIPE_EASING(0), 0);
    assert.equal(SWIPE_EASING(1), 1);
    assert.ok(SWIPE_EASING(0.5) > 0.5);
    assert.ok(Math.abs(SWIPE_EASING(0.5) - (1 - 0.5 ** 3)) < 1e-12);
  });
});

describe('initial reduced-motion (native cold start)', () => {
  it('is optimistic ON when matchMedia is unavailable (native / unknown)', () => {
    assert.equal(resolveInitialReducedMotion(null), true);
  });

  it('follows the sync web matchMedia read', () => {
    assert.equal(resolveInitialReducedMotion(false), false);
    assert.equal(resolveInitialReducedMotion(true), true);
  });

  it('treats this node test env as unknown (no window matchMedia) → optimistic ON', () => {
    assert.equal(initialPrefersReducedMotion(), true);
  });
});
