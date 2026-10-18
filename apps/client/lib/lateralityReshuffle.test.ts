import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { motion } from '../theme/tokens.ts';
import {
  reshuffleCanSettle,
  reshuffleDealMs,
  reshuffleGatherMs,
  reshuffleMinCueMs,
  reshuffleReverseMs,
  reshuffleSilhouetteCount,
  reshuffleStatusDelayMs,
  reshuffleStatusVisible,
  reshuffleTimedOut,
  reshuffleTimeoutMs,
} from './lateralityReshuffle.ts';

describe('laterality reshuffle timing tokens', () => {
  it('pins §23 reshuffle timings', () => {
    assert.equal(reshuffleStatusDelayMs(), 300);
    assert.equal(reshuffleMinCueMs(), 900);
    assert.equal(reshuffleTimeoutMs(), 10000);
    assert.equal(motion.reshuffle.cardInputDuringShuffle, false);
  });

  it('uses a single silhouette crossfade under reduced motion', () => {
    assert.equal(reshuffleSilhouetteCount(true), 1);
    assert.equal(reshuffleSilhouetteCount(false), 3);
    assert.equal(reshuffleGatherMs(true), 0);
    assert.equal(reshuffleGatherMs(false), 260);
    assert.equal(reshuffleDealMs(true), 150);
    assert.equal(reshuffleDealMs(false), 360);
    assert.equal(reshuffleReverseMs(true), 150);
    assert.equal(reshuffleReverseMs(false), 260);
  });

  it('shows status after the delay and settles only after min cue + fetch', () => {
    assert.equal(reshuffleStatusVisible(299), false);
    assert.equal(reshuffleStatusVisible(300), true);
    assert.equal(reshuffleCanSettle(899, true), false);
    assert.equal(reshuffleCanSettle(900, false), false);
    assert.equal(reshuffleCanSettle(900, true), true);
    assert.equal(reshuffleTimedOut(9999), false);
    assert.equal(reshuffleTimedOut(10000), true);
  });
});
