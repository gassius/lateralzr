import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CARD_STACK_BEHIND_TINT,
  CARD_STACK_BEHIND_TINT_ALPHA,
  CARD_STACK_BEHIND_TINT_ALPHA_LEGACY,
  CARD_SWIPE_ENTER_ROLL_DEG,
  CARD_SWIPE_MAX_PITCH_DEG,
  CARD_SWIPE_MAX_ROLL_DEG,
  CARD_SWIPE_MAX_YAW_DEG,
  CARD_SWIPE_PERSPECTIVE,
  cardCoverDimOpacity,
  cardReturnOverlayRollDeg,
  cardReturnOverlayYawDeg,
  cardSwipePitchDeg,
  cardSwipeRollDeg,
  cardSwipeYawDeg,
  shouldUseCardSwipe3d,
} from './cardSwipeMotion.ts';

const CARD_W = 360;
const CARD_H = 400;

describe('card swipe 3D budget', () => {
  it('keeps pitch and yaw mild (tactile, not arcade)', () => {
    assert.ok(CARD_SWIPE_MAX_PITCH_DEG >= 6);
    assert.ok(CARD_SWIPE_MAX_PITCH_DEG <= 10);
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
    assert.equal(cardSwipeYawDeg(-90, -80, CARD_W, CARD_H, -14, true), 0);
    assert.equal(cardReturnOverlayRollDeg(0, true), 0);
    assert.equal(cardReturnOverlayYawDeg(0, true), 0);
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
