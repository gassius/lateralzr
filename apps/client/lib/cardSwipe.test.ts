import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SWIPE_COMMIT_RATIO,
  SWIPE_EASING,
  SWIPE_ENTER_SHIFT_PX,
  SWIPE_FLING_PX_PER_MS,
  SWIPE_REDUCED_MOTION_CROSSFADE_MS,
  SWIPE_RETURN_MS,
  SWIPE_SETTLE_MS,
  cardSwipeFrontTransform,
  cardSwipeReturnOverlayTransform,
  cardSwipeTransformHasRotateOrPerspective,
  initialPrefersReducedMotion,
  resolveInitialReducedMotion,
  shouldCommitSwipe,
  swipeCommitDirection,
  swipeCommitDurationMs,
  swipeEnterShiftPx,
  swipeShouldSlideOutOnCommit,
} from './cardSwipe.ts';
import { motion, spacing } from '../theme/tokens.ts';

const CARD_W = 360;

describe('swipe motion tokens', () => {
  it('pins commit / fling / settle / return / RM cross-fade from motion.*', () => {
    assert.equal(SWIPE_COMMIT_RATIO, motion.swipeCommitRatio);
    assert.equal(SWIPE_COMMIT_RATIO, 0.3);
    assert.equal(SWIPE_FLING_PX_PER_MS, motion.swipeFlingPxPerMs);
    assert.equal(SWIPE_FLING_PX_PER_MS, 0.5);
    assert.equal(SWIPE_SETTLE_MS, motion.swipeSettleMs);
    assert.equal(SWIPE_SETTLE_MS, 260);
    assert.equal(SWIPE_RETURN_MS, motion.swipeReturnMs);
    assert.equal(SWIPE_RETURN_MS, 200);
    assert.equal(SWIPE_REDUCED_MOTION_CROSSFADE_MS, motion.reducedMotionCrossfadeMs);
    assert.equal(SWIPE_REDUCED_MOTION_CROSSFADE_MS, 150);
    assert.equal(SWIPE_ENTER_SHIFT_PX, spacing[1]);
    assert.equal(SWIPE_ENTER_SHIFT_PX, 8);
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

describe('quiet swipe transforms', () => {
  it('front and return overlay are translate-only (no rotate / perspective)', () => {
    const front = cardSwipeFrontTransform(-80, -120);
    const ret = cardSwipeReturnOverlayTransform(-CARD_W * 0.4);
    assert.deepEqual(front, [{ translateX: -80 }, { translateY: -120 }]);
    assert.deepEqual(ret, [{ translateX: -CARD_W * 0.4 }]);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(front), false);
    assert.equal(cardSwipeTransformHasRotateOrPerspective(ret), false);
    for (const step of [...front, ...ret]) {
      for (const key of Object.keys(step)) {
        assert.ok(key === 'translateX' || key === 'translateY');
      }
    }
  });
});

describe('reduced-motion swipe commit branch', () => {
  it('uses 150 ms cross-fade, no enter shift, no slide-out', () => {
    assert.equal(swipeCommitDurationMs(true), SWIPE_REDUCED_MOTION_CROSSFADE_MS);
    assert.equal(swipeCommitDurationMs(true), 150);
    assert.equal(swipeEnterShiftPx(true, true), 0);
    assert.equal(swipeEnterShiftPx(true, false), 0);
    assert.equal(swipeShouldSlideOutOnCommit(true), false);
  });

  it('keeps settle timing / ±8 shift / slide-out when RM is off', () => {
    assert.equal(swipeCommitDurationMs(false), SWIPE_SETTLE_MS);
    assert.equal(swipeEnterShiftPx(false, true), SWIPE_ENTER_SHIFT_PX);
    assert.equal(swipeEnterShiftPx(false, false), -SWIPE_ENTER_SHIFT_PX);
    assert.equal(swipeShouldSlideOutOnCommit(false), true);
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
