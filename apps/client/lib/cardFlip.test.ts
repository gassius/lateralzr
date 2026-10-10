import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { motion } from '@/theme/tokens';
import {
  FLIP_EASING,
  FLIP_MS,
  FLIP_REDUCED_MOTION_CROSSFADE_MS,
  cardFlipFaceStyle,
  cardFlipTransformHasRotateOrPerspective,
  flipDurationMs,
  flipUses3d,
} from '@/lib/cardFlip';

describe('card flip tokens', () => {
  it('pins flip duration to motion.flipMs (360)', () => {
    assert.equal(FLIP_MS, motion.flipMs);
    assert.equal(FLIP_MS, 360);
    assert.equal(FLIP_REDUCED_MOTION_CROSSFADE_MS, motion.reducedMotionCrossfadeMs);
    assert.equal(FLIP_REDUCED_MOTION_CROSSFADE_MS, 150);
  });
});

describe('flip duration / 3D gate', () => {
  it('uses 360 ms full flip and 150 ms RM cross-fade', () => {
    assert.equal(flipDurationMs(false), 360);
    assert.equal(flipDurationMs(true), 150);
    assert.equal(flipUses3d(false), true);
    assert.equal(flipUses3d(true), false);
  });

  it('FLIP_EASING is cubic ease-out', () => {
    assert.equal(FLIP_EASING(0), 0);
    assert.equal(FLIP_EASING(1), 1);
    assert.ok(FLIP_EASING(0.5) > 0.5);
    assert.ok(Math.abs(FLIP_EASING(0.5) - (1 - 0.5 ** 3)) < 1e-12);
  });
});

describe('cardFlipFaceStyle', () => {
  it('under RM: opacity only, no rotate / perspective', () => {
    const front = cardFlipFaceStyle(0.4, 'front', true);
    const back = cardFlipFaceStyle(0.4, 'back', true);
    assert.equal(front.opacity, 0.6);
    assert.equal(back.opacity, 0.4);
    assert.deepEqual(front.transform, []);
    assert.deepEqual(back.transform, []);
    assert.equal(cardFlipTransformHasRotateOrPerspective(front.transform), false);
    assert.equal(cardFlipTransformHasRotateOrPerspective(back.transform), false);
  });

  it('full motion: rotateY + perspective at mid flip', () => {
    const front = cardFlipFaceStyle(0.5, 'front', false);
    const back = cardFlipFaceStyle(0.5, 'back', false);
    assert.equal(cardFlipTransformHasRotateOrPerspective(front.transform), true);
    assert.equal(cardFlipTransformHasRotateOrPerspective(back.transform), true);
    assert.ok(front.transform.some((s) => 'rotateY' in s));
    assert.ok(back.transform.some((s) => 'perspective' in s));
  });

  it('endpoints: front visible at 0, back at 1 (both modes)', () => {
    for (const rm of [false, true]) {
      assert.equal(cardFlipFaceStyle(0, 'front', rm).opacity, 1);
      assert.equal(cardFlipFaceStyle(0, 'back', rm).opacity, 0);
      assert.equal(cardFlipFaceStyle(1, 'front', rm).opacity, 0);
      assert.equal(cardFlipFaceStyle(1, 'back', rm).opacity, 1);
    }
  });
});
