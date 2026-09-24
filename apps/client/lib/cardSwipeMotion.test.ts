import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CARD_STACK_BEHIND_TINT,
  CARD_STACK_BEHIND_TINT_ALPHA,
  CARD_STACK_BEHIND_TINT_ALPHA_LEGACY,
  CARD_SWIPE_ENTER_ROLL_DEG,
  CARD_SWIPE_MAX_PITCH_DEG,
  CARD_SWIPE_MAX_ROLL_DEG,
  CARD_SWIPE_MAX_VERTICAL_ROLL_DEG,
  CARD_SWIPE_MAX_YAW_DEG,
  CARD_SWIPE_PERSPECTIVE,
  cardCoverDimOpacity,
  cardReturnOverlayRollDeg,
  cardReturnOverlayYawDeg,
  cardSwipeFrontTransform,
  cardSwipePitchDeg,
  cardSwipeReturnOverlayTransform,
  cardSwipeRollDeg,
  cardSwipeTransformHas3d,
  cardSwipeVerticalRollDeg,
  cardSwipeYawDeg,
  initialPrefersReducedMotion,
  resolveInitialReducedMotion,
  shouldUseCardSwipe3d,
} from './cardSwipeMotion.ts';

const CARD_W = 360;
const CARD_H = 400;

describe('card swipe 3D budget', () => {
  it('keeps pitch and yaw mild (tactile, not arcade)', () => {
    assert.ok(CARD_SWIPE_MAX_PITCH_DEG >= 6);
    assert.ok(CARD_SWIPE_MAX_PITCH_DEG <= 10);
    assert.ok(CARD_SWIPE_MAX_VERTICAL_ROLL_DEG >= 4);
    assert.ok(CARD_SWIPE_MAX_VERTICAL_ROLL_DEG <= 8);
    assert.ok(CARD_SWIPE_MAX_YAW_DEG >= 3);
    assert.ok(CARD_SWIPE_MAX_YAW_DEG <= 6);
    assert.ok(CARD_SWIPE_MAX_YAW_DEG < CARD_SWIPE_MAX_PITCH_DEG);
    assert.equal(CARD_SWIPE_PERSPECTIVE, 1200);
    assert.equal(CARD_SWIPE_MAX_ROLL_DEG, 45);
    assert.equal(CARD_SWIPE_ENTER_ROLL_DEG, 14);
  });

  it('skips compulsory 3D when reduced motion is requested', () => {
    assert.equal(shouldUseCardSwipe3d(false), true);
    assert.equal(shouldUseCardSwipe3d(true), false);
    assert.equal(cardSwipeRollDeg(-90, CARD_W, true), 0);
    assert.equal(cardSwipePitchDeg(-120, CARD_H, true), 0);
    assert.equal(cardSwipeVerticalRollDeg(-120, CARD_H, true), 0);
    assert.equal(cardSwipeYawDeg(-90, -80, CARD_W, CARD_H, -14, true), 0);
    assert.equal(cardReturnOverlayRollDeg(0, true), 0);
    assert.equal(cardReturnOverlayYawDeg(0, true), 0);
  });
});

describe('initial reduced-motion (native cold start)', () => {
  it('is optimistic ON when matchMedia is unavailable (native / unknown)', () => {
    assert.equal(resolveInitialReducedMotion(null), true);
    assert.equal(shouldUseCardSwipe3d(resolveInitialReducedMotion(null)), false);
  });

  it('follows the sync web matchMedia read', () => {
    assert.equal(resolveInitialReducedMotion(false), false);
    assert.equal(shouldUseCardSwipe3d(resolveInitialReducedMotion(false)), true);
    assert.equal(resolveInitialReducedMotion(true), true);
    assert.equal(shouldUseCardSwipe3d(resolveInitialReducedMotion(true)), false);
  });

  it('treats this node test env as unknown (no window matchMedia) → optimistic ON', () => {
    assert.equal(initialPrefersReducedMotion(), true);
  });
});

describe('stack wiring (RM → translate-only transform)', () => {
  it('front and return overlay omit perspective/rotates when reduced motion is on', () => {
    const front = cardSwipeFrontTransform(-80, -120, CARD_W, CARD_H, -14, true);
    const ret = cardSwipeReturnOverlayTransform(-CARD_W * 0.4, CARD_H, 0.3, true);
    assert.deepEqual(front, [{ translateX: -80 }, { translateY: -120 }]);
    assert.deepEqual(ret, [{ translateX: -CARD_W * 0.4 }]);
    assert.equal(cardSwipeTransformHas3d(front), false);
    assert.equal(cardSwipeTransformHas3d(ret), false);
  });

  it('front and return overlay use 3D when reduced motion is off', () => {
    const front = cardSwipeFrontTransform(-80, -120, CARD_W, CARD_H, 0, false);
    const ret = cardSwipeReturnOverlayTransform(-CARD_W * 0.4, CARD_H, 0, false);
    assert.equal(front[0]?.perspective, CARD_SWIPE_PERSPECTIVE);
    assert.equal(ret[0]?.perspective, CARD_SWIPE_PERSPECTIVE);
    assert.equal(cardSwipeTransformHas3d(front), true);
    assert.equal(cardSwipeTransformHas3d(ret), true);
    assert.equal(front.length === 8 && 'rotateX' in front[3], true);
    assert.equal(front.length === 8 && 'rotateY' in front[4], true);
    assert.equal(front.length === 8 && 'rotateZ' in front[6], true);
  });

  it('native optimistic RM wires a translate-only front transform before AccessibilityInfo', () => {
    const reduceMotion = resolveInitialReducedMotion(null);
    const transform = cardSwipeFrontTransform(-56, -80, CARD_W, CARD_H, 0, reduceMotion);
    assert.equal(cardSwipeTransformHas3d(transform), false);
  });
});

describe('card swipe roll (existing left-swipe formula)', () => {
  it('tilts only while traveling left and preserves the previous scale', () => {
    assert.equal(cardSwipeRollDeg(0, CARD_W, false), 0);
    assert.equal(cardSwipeRollDeg(80, CARD_W, false), 0);
    assert.equal(cardSwipeRollDeg(-CARD_W / 2, CARD_W, false), -CARD_SWIPE_MAX_ROLL_DEG);
    assert.equal(cardSwipeRollDeg(-90, CARD_W, false), -22.5);
    assert.equal(cardSwipeRollDeg(-CARD_W, CARD_W, false), -CARD_SWIPE_MAX_ROLL_DEG);
  });
});

describe('card swipe pitch', () => {
  it('pitches with vertical travel and returns to flat at rest', () => {
    assert.equal(cardSwipePitchDeg(0, CARD_H, false), 0);
    assert.equal(cardSwipePitchDeg(-CARD_H / 2, CARD_H, false), CARD_SWIPE_MAX_PITCH_DEG);
    assert.equal(cardSwipePitchDeg(CARD_H / 2, CARD_H, false), -CARD_SWIPE_MAX_PITCH_DEG);
    assert.ok(cardSwipePitchDeg(-56, CARD_H, false) > 0);
    assert.ok(cardSwipePitchDeg(56, CARD_H, false) < 0);
  });
});

describe('card swipe vertical roll', () => {
  it('tilts a little with up/down travel and returns to flat at rest', () => {
    assert.equal(cardSwipeVerticalRollDeg(0, CARD_H, false), 0);
    assert.equal(
      cardSwipeVerticalRollDeg(CARD_H / 2, CARD_H, false),
      CARD_SWIPE_MAX_VERTICAL_ROLL_DEG,
    );
    assert.ok(cardSwipeVerticalRollDeg(-56, CARD_H, false) < 0);
    assert.ok(cardSwipeVerticalRollDeg(56, CARD_H, false) > 0);
  });
});

describe('card swipe yaw', () => {
  it('adds a hint of rotateY that settles to 0', () => {
    assert.equal(cardSwipeYawDeg(0, 0, CARD_W, CARD_H, 0, false), 0);
    assert.ok(cardSwipeYawDeg(-90, 0, CARD_W, CARD_H, 0, false) < 0);
    assert.ok(cardSwipeYawDeg(0, 80, CARD_W, CARD_H, 0, false) > 0);
    assert.ok(cardSwipeYawDeg(0, 0, CARD_W, CARD_H, -CARD_SWIPE_ENTER_ROLL_DEG, false) < 0);
    assert.equal(
      cardSwipeYawDeg(-CARD_W, 0, CARD_W, CARD_H, 0, false),
      -CARD_SWIPE_MAX_YAW_DEG,
    );
  });
});

describe('return overlay settle', () => {
  it('starts tilted and finishes flat as the previous card seats', () => {
    assert.equal(cardReturnOverlayRollDeg(0, false), -CARD_SWIPE_ENTER_ROLL_DEG);
    assert.equal(cardReturnOverlayYawDeg(0, false), -CARD_SWIPE_MAX_YAW_DEG);
    assert.equal(cardReturnOverlayRollDeg(1, false), 0);
    assert.equal(cardReturnOverlayYawDeg(1, false), 0);
    assert.ok(Math.abs(cardReturnOverlayRollDeg(0.5, false)) < CARD_SWIPE_ENTER_ROLL_DEG);
  });
});

describe('stack depth tint', () => {
  it('darkens the rear card more than the previous 10% overlay', () => {
    assert.ok(CARD_STACK_BEHIND_TINT_ALPHA > CARD_STACK_BEHIND_TINT_ALPHA_LEGACY);
    assert.ok(CARD_STACK_BEHIND_TINT_ALPHA <= 0.28);
    assert.equal(CARD_STACK_BEHIND_TINT, `rgba(19,91,119,${CARD_STACK_BEHIND_TINT_ALPHA})`);
    assert.equal(cardCoverDimOpacity(0), 0);
    assert.equal(cardCoverDimOpacity(1), 1);
    assert.equal(cardCoverDimOpacity(0.5), 0.5);
  });
});
