import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideEmptyBatchRetry,
  deckAfterFetchFailure,
  EMPTY_RETRY_BACKOFF_MS,
  MAX_EMPTY_RETRY_ATTEMPTS,
  shouldResetEmptyRetryCounter,
} from './emptyBatchRetry.ts';

describe('decideEmptyBatchRetry', () => {
  it('schedules exactly 1.5s, 3s, 6s then exhausts', () => {
    assert.deepEqual(decideEmptyBatchRetry(0), {
      action: 'schedule',
      delayMs: 1500,
      attemptCount: 1,
    });
    assert.deepEqual(decideEmptyBatchRetry(1), {
      action: 'schedule',
      delayMs: 3000,
      attemptCount: 2,
    });
    assert.deepEqual(decideEmptyBatchRetry(2), {
      action: 'schedule',
      delayMs: 6000,
      attemptCount: 3,
    });
    assert.deepEqual(decideEmptyBatchRetry(3), {
      action: 'exhausted',
      attemptCount: 4,
    });
  });

  it('pins the backoff table to three capped attempts', () => {
    assert.equal(MAX_EMPTY_RETRY_ATTEMPTS, 3);
    assert.deepEqual([...EMPTY_RETRY_BACKOFF_MS], [1500, 3000, 6000]);
  });

  it('treats negative prior counts as a first attempt', () => {
    assert.deepEqual(decideEmptyBatchRetry(-1), {
      action: 'schedule',
      delayMs: 1500,
      attemptCount: 1,
    });
  });
});

describe('shouldResetEmptyRetryCounter', () => {
  it('resets on Laterality, Complexity, Adjust, and manual forward swipe', () => {
    assert.equal(shouldResetEmptyRetryCounter('laterality'), true);
    assert.equal(shouldResetEmptyRetryCounter('complexity'), true);
    assert.equal(shouldResetEmptyRetryCounter('adjust'), true);
    assert.equal(shouldResetEmptyRetryCounter('manualForwardSwipe'), true);
  });

  it('also resets after a successful append or manual Retry', () => {
    assert.equal(shouldResetEmptyRetryCounter('successfulAppend'), true);
    assert.equal(shouldResetEmptyRetryCounter('manualRetry'), true);
  });
});

describe('deckAfterFetchFailure', () => {
  it('never resets history (concepts or index)', () => {
    const concepts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const before = { concepts, currentIndex: 2 };
    const after = deckAfterFetchFailure(before);
    assert.equal(after.concepts, concepts);
    assert.equal(after.currentIndex, 2);
    assert.deepEqual(after.concepts, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });
});
