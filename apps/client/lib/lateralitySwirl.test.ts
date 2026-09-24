import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lateralitySwirlAngle,
  lateralitySwirlCardCount,
  lateralitySwirlCardPose,
  lateralitySwirlHoldMs,
  lateralitySwirlOverlayOpacity,
  lateralitySwirlSettledPose,
  lateralitySwirlStaticPose,
  LATERALITY_SWIRL_CARD_COUNT,
  LATERALITY_SWIRL_FAILURE_MIN_MS,
  LATERALITY_SWIRL_MAX_TILT_DEG,
  LATERALITY_SWIRL_MIN_MS,
  LATERALITY_SWIRL_REDUCED_CARD_COUNT,
  LATERALITY_SWIRL_REDUCED_HOLD_MS,
  shouldAnimateLateralitySwirl,
} from './lateralitySwirl.ts';

describe('laterality swirl motion language', () => {
  it('uses several cards so the load reads as a deck, not a spinner', () => {
    assert.ok(LATERALITY_SWIRL_CARD_COUNT >= 4);
    assert.equal(lateralitySwirlCardCount(false), LATERALITY_SWIRL_CARD_COUNT);
    assert.equal(lateralitySwirlCardCount(true), LATERALITY_SWIRL_REDUCED_CARD_COUNT);
    assert.ok(lateralitySwirlCardCount(true) >= 3);
  });

  it('offsets each card around the orbit so they shuffle past one another', () => {
    const poses = [0, 1, 2, 3, 4].map((index) => lateralitySwirlCardPose(0, index, 40));
    const keys = new Set(poses.map((pose) => `${Math.round(pose.x)},${Math.round(pose.y)}`));
    assert.equal(keys.size, poses.length);
    assert.ok(poses.some((pose) => pose.rotateDeg !== 0));
    assert.ok(poses.every((pose) => Math.abs(pose.rotateDeg) <= LATERALITY_SWIRL_MAX_TILT_DEG + 0.01));
  });

  it('advances the orbit as progress loops (cards actually travel)', () => {
    const start = lateralitySwirlCardPose(0, 0, 40);
    const mid = lateralitySwirlCardPose(0.25, 0, 40);
    assert.notEqual(Math.round(start.x), Math.round(mid.x));
    assert.ok(Math.abs(lateralitySwirlAngle(1, 0, 5) - lateralitySwirlAngle(0, 0, 5) - Math.PI * 2) < 1e-9);
  });

  it('keeps tilt modest so the shuffle stays calm', () => {
    assert.ok(LATERALITY_SWIRL_MAX_TILT_DEG <= 18);
    for (const progress of [0, 0.3, 0.6, 0.9]) {
      const pose = lateralitySwirlCardPose(progress, 1, 48);
      assert.ok(pose.scale >= 0.84 && pose.scale <= 1.001);
    }
  });

  it('settles onto the current card without a jump to opacity 0 at the start', () => {
    const pose = lateralitySwirlCardPose(0.1, 2, 36);
    const atRest = lateralitySwirlSettledPose(pose, 0);
    assert.equal(atRest.x, pose.x);
    assert.equal(atRest.opacity, 1);
    const done = lateralitySwirlSettledPose(pose, 1);
    assert.equal(done.x, 0);
    assert.equal(done.y, 0);
    assert.equal(done.rotateDeg, 0);
    assert.equal(done.scale, 1);
    assert.equal(done.opacity, 0);
  });

  it('fades the teal wash with settle so the real card is not a white flash', () => {
    assert.equal(lateralitySwirlOverlayOpacity(1, 0), 1);
    assert.equal(lateralitySwirlOverlayOpacity(1, 1), 0);
    assert.ok(lateralitySwirlOverlayOpacity(1, 0.5) > 0);
    assert.ok(lateralitySwirlOverlayOpacity(1, 0.5) < 1);
  });
});

describe('laterality swirl reduced motion', () => {
  it('skips compulsory orbit when reduced motion is requested', () => {
    assert.equal(shouldAnimateLateralitySwirl(true), false);
    assert.equal(shouldAnimateLateralitySwirl(false), true);
  });

  it('uses a still fan instead of an orbit', () => {
    const poses = [0, 1, 2].map((index) => lateralitySwirlStaticPose(index, 3, 20));
    assert.notEqual(poses[0]?.rotateDeg, poses[2]?.rotateDeg);
    assert.equal(poses[1]?.x, 0);
    assert.ok((poses[2]?.x ?? 0) > 0);
  });

  it('holds just long enough to cover a fast fetch, then exits without a swirl', () => {
    assert.equal(lateralitySwirlHoldMs('success', 0, false), LATERALITY_SWIRL_REDUCED_HOLD_MS);
    assert.equal(lateralitySwirlHoldMs('failure', 400, false), 0);
  });
});

describe('laterality swirl timing vs fetch', () => {
  it('keeps swirling until the minimum when the tree comes back instantly', () => {
    assert.equal(lateralitySwirlHoldMs('success', 0, true), LATERALITY_SWIRL_MIN_MS);
    assert.equal(lateralitySwirlHoldMs('success', LATERALITY_SWIRL_MIN_MS + 80, true), 0);
  });

  it('lets a failed fetch leave sooner so the UI is not stuck mid-swirl', () => {
    assert.ok(LATERALITY_SWIRL_FAILURE_MIN_MS < LATERALITY_SWIRL_MIN_MS);
    assert.equal(lateralitySwirlHoldMs('failure', 0, true), LATERALITY_SWIRL_FAILURE_MIN_MS);
    assert.equal(lateralitySwirlHoldMs('failure', LATERALITY_SWIRL_FAILURE_MIN_MS, true), 0);
  });
});
