import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DECK_FRONT_MOVING_Z,
  DECK_FRONT_REST_Z,
  DECK_NEXT_OFFSET_Y,
  DECK_NEXT_SCALE,
  DECK_NEXT_TINT,
  DECK_NEXT_VISIBLE_AT_REST,
  DECK_RETURN_OVERLAY_COVERING_Z,
  DECK_RETURN_OVERLAY_Z,
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
  cardSwipeDragTiltZDeg,
  cardSwipeExitTiltZDeg,
  cardSwipeAndroidLiftFill,
  cardSwipeFollowY,
  cardSwipeFrontTransform,
  cardSwipeLiftShadowPx,
  cardSwipeLiftShadowStyle,
  cardSwipePitchDeg,
  cardSwipeReturnOverlayTransform,
  cardSwipeTiltYDeg,
  cardSwipeTiltZDeg,
  cardSwipeTransformHasRotateOrPerspective,
  cardSwipeTranslationAfterHandoff,
  cardSwipeVerticalRollDeg,
  deckCommitCrossfadeProgress,
  deckFrontWrapZIndex,
  deckLayerVisibility,
  deckPreviousCovering,
  deckReducedMotionFadesOutgoingFront,
  deckReturnOverlayZIndex,
  deckUnderlayDragProgress,
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

const here = path.dirname(fileURLToPath(import.meta.url));
const stackSrc = readFileSync(path.join(here, '../components/ConceptCardStack.tsx'), 'utf8');
const indexSrc = readFileSync(path.join(here, '../app/index.tsx'), 'utf8');

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
    assert.equal(cardSwipeTiltZDeg(0, CARD_W, false), 0);
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

  it('left swipe: 8° rotateZ at 50% width, max 12°, rotateY ≤ 3°', () => {
    assert.equal(cardSwipeTiltZDeg(-0.5 * CARD_W, CARD_W, false), -8);
    assert.equal(cardSwipeTiltZDeg(-CARD_W, CARD_W, false), -12);
    assert.equal(cardSwipeDragTiltZDeg(-CARD_W, CARD_W, false), -12);
    const yaw = cardSwipeTiltYDeg(-CARD_W, CARD_W, false);
    assert.ok(Math.abs(yaw) <= 3);
    assert.ok(yaw < 0);
  });

  it('left exit ramps release tilt to −14°; tx===0 stays 0°', () => {
    const release = cardSwipeTiltZDeg(-0.3 * CARD_W, CARD_W, false);
    assert.equal(release, -4.8);
    assert.equal(cardSwipeExitTiltZDeg(release, 0, -1), -4.8);
    assert.ok(Math.abs(cardSwipeExitTiltZDeg(release, 0.5, -1) - -9.4) < 1e-10);
    assert.equal(cardSwipeExitTiltZDeg(release, 1, -1), -14);
    assert.equal(cardSwipeTiltZDeg(-0.3 * CARD_W, CARD_W, false, 1, release, -1), -14);
    // Keyboard / a11y Next: tx===0 is 0° (no jump); once travel is left, ramp to −14°.
    assert.equal(cardSwipeTiltZDeg(0, CARD_W, false, 0, 0, -1), 0);
    assert.equal(cardSwipeTiltZDeg(0, CARD_W, false, 1, 0, -1), 0);
    assert.equal(cardSwipeExitTiltZDeg(0, 0, -1), 0);
    assert.equal(cardSwipeExitTiltZDeg(0, 0.5, -1), -7);
    assert.equal(cardSwipeExitTiltZDeg(0, 1, -1), -14);
    assert.equal(cardSwipeTiltZDeg(-1, CARD_W, false, 1, 0, -1), -14);
  });

  it('right / Previous exit does not tilt the covered card', () => {
    assert.equal(cardSwipeExitTiltZDeg(0, 1, 1), 0);
    assert.equal(cardSwipeExitTiltZDeg(4.8, 1, 1), 0);
    assert.equal(cardSwipeTiltZDeg(0, CARD_W, false, 1, 0, 1), 0);
    assert.equal(cardSwipeTiltZDeg(0, CARD_W, false, 1, 4.8, 1), 0);
    const rightXf = cardSwipeFrontTransform(0, 0, CARD_W, CARD_H, false, 1, 0, 1);
    const z = rightXf.find((s) => 'rotateZ' in s) as { rotateZ: string } | undefined;
    assert.equal(z?.rotateZ, '0deg');
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

  it('lift shadow style carries §23 color / opacity / radius (no hard black bar)', () => {
    const rest = cardSwipeLiftShadowStyle(0);
    assert.equal(rest.shadowColor, '#000000');
    assert.equal(rest.shadowOffset.height, 4);
    assert.equal(rest.shadowOpacity, 0.18);
    assert.equal(rest.shadowRadius, 12);
    assert.equal(rest.elevation, 4);
    const lifted = cardSwipeLiftShadowStyle(6);
    assert.equal(lifted.shadowOffset.height, 10);
    assert.equal(lifted.elevation, 10);
    assert.equal(lifted.shadowOpacity, 0.18);
    assert.equal(lifted.shadowColor, rest.shadowColor);
  });

  it('Android wrap fill is only while lifted, never mid-flip / peek / deck status', () => {
    const lifted = { liftPx: 6, flipProgress: 0, flipPeek: 0, showDeckStatus: false };
    assert.equal(cardSwipeAndroidLiftFill(lifted), true);
    assert.equal(cardSwipeAndroidLiftFill({ ...lifted, liftPx: 0 }), false);
    assert.equal(cardSwipeAndroidLiftFill({ ...lifted, showDeckStatus: true }), false);
    assert.equal(cardSwipeAndroidLiftFill({ ...lifted, flipPeek: 0.2 }), false);
    assert.equal(cardSwipeAndroidLiftFill({ ...lifted, flipProgress: 0.5 }), false);
    assert.equal(cardSwipeAndroidLiftFill({ ...lifted, flipProgress: 1 }), true);
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
    assert.equal(cardSwipeTiltZDeg(-180, CARD_W, true, 1, -8, -1), 0);
    assert.equal(cardSwipePitchDeg(-200, CARD_H, true), 0);
    assert.equal(cardSwipeFollowY(40, true), 0);
    assert.equal(cardSwipeFollowY(-30, true), 0);
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

describe('underlay axis lock and RM cross-fade', () => {
  it('ignores vertical drift while translating right (back swipe)', () => {
    assert.equal(deckUnderlayDragProgress(-80, 0, CARD_W, CARD_H), 80 / CARD_W);
    assert.equal(deckUnderlayDragProgress(80, 40, CARD_W, CARD_H), 0);
    assert.equal(deckUnderlayDragProgress(0, 100, CARD_W, CARD_H), 100 / CARD_H);
    assert.equal(deckUnderlayDragProgress(-10, 100, CARD_W, CARD_H), Math.max(10 / CARD_W, 100 / CARD_H));
  });

  it('RM Previous keeps the covered card opaque so the shell cannot show', () => {
    assert.equal(deckReducedMotionFadesOutgoingFront('right'), false);
    assert.equal(deckReducedMotionFadesOutgoingFront('left'), true);
    assert.equal(deckReducedMotionFadesOutgoingFront('vertical'), true);
  });

  it('RM commit reveal uses peer opacity when drag is zeroed', () => {
    assert.equal(deckCommitCrossfadeProgress(0, 0), 0);
    assert.equal(deckCommitCrossfadeProgress(0, 0.4), 0.4);
    assert.equal(deckCommitCrossfadeProgress(0, 1), 1);
    assert.equal(deckCommitCrossfadeProgress(0.8, 0.2), 0.8);
    const rest = deckUnderlayReveal(deckCommitCrossfadeProgress(0, 0), true, false);
    assert.equal(rest.opacity, 0);
    const mid = deckUnderlayReveal(deckCommitCrossfadeProgress(0, 0.5), true, false);
    assert.equal(mid.opacity, 1);
  });
});

describe('stack / shell wiring (AD B2–B4, M3)', () => {
  it('raises the stack wrapper above laterality-chrome and the ellipsis while moving', () => {
    assert.match(indexSrc, /deckMoving \? styles\.deckStackLayerMoving/);
    assert.match(indexSrc, /deckStackLayerMoving:\s*\{[\s\S]*zIndex:\s*40/);
    assert.equal(/deckStackLayer:\s*\{[^}]*zIndex:\s*40/.test(indexSrc), false);
    assert.match(indexSrc, /lateralityChrome:\s*\{[\s\S]*zIndex:\s*1/);
    assert.match(indexSrc, /style=\{styles\.lateralityChrome\}/);
    const movingGroupHits = indexSrc.split('deckMoving ? styles.deckMovingGroup').length - 1;
    assert.ok(movingGroupHits >= 3, `expected deckMovingGroup on group + both practice columns, got ${movingGroupHits}`);
  });

  it('RM Previous keeps frontCommitOpacity at 1 (overlay fades in on top)', () => {
    assert.match(stackSrc, /deckReducedMotionFadesOutgoingFront\('right'\)/);
    assert.match(stackSrc, /borderRadius: cardRadius\(\)/);
    assert.equal(/frontWrap:\s*\{[^}]*backgroundColor: color\.front/.test(stackSrc), false);
    assert.match(stackSrc, /cardSwipeAndroidLiftFill/);
  });

  it('reads peerCommitOpacity for RM underlay and return-overlay cross-fade', () => {
    assert.match(stackSrc, /rmPeerLayerSV\.value < 0 \? peerCommitOpacity\.value/);
    assert.match(stackSrc, /rmPeerLayerSV\.value > 0 \? peerCommitOpacity\.value/);
    assert.match(stackSrc, /deckCommitCrossfadeProgress/);
    assert.match(stackSrc, /\.\.\.cardSwipeLiftShadowStyle\(shadowLift\)/);
    assert.equal(stackSrc.includes('shadowOffset: { width: 0, height: 4 + lift }'), false);
  });

  it('Previous covering keeps front at rest z and raises the overlay above it', () => {
    assert.equal(deckPreviousCovering(0, 0), false);
    assert.equal(deckPreviousCovering(-40, 0), false);
    assert.equal(deckPreviousCovering(40, 0), true);
    assert.equal(deckPreviousCovering(0, 1), true);
    assert.equal(deckPreviousCovering(0, -1), false);
    assert.equal(deckFrontWrapZIndex(true, true), DECK_FRONT_REST_Z);
    assert.equal(deckFrontWrapZIndex(true, false), DECK_FRONT_REST_Z);
    assert.equal(deckFrontWrapZIndex(false, true), DECK_FRONT_MOVING_Z);
    assert.equal(deckFrontWrapZIndex(false, false), DECK_FRONT_REST_Z);
    assert.equal(deckReturnOverlayZIndex(true), DECK_RETURN_OVERLAY_COVERING_Z);
    assert.equal(deckReturnOverlayZIndex(false), DECK_RETURN_OVERLAY_Z);
    assert.ok(DECK_RETURN_OVERLAY_COVERING_Z > DECK_FRONT_MOVING_Z);
    assert.match(stackSrc, /deckPreviousCovering\(rawTx, rmPeerLayerSV\.value\)/);
    assert.match(stackSrc, /zIndex: deckFrontWrapZIndex\(covering, moving\)/);
    assert.match(stackSrc, /zIndex: deckReturnOverlayZIndex\(covering\)/);
    assert.match(stackSrc, /const shadowLift = covering \? 0 : lift/);
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
