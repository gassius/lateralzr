import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEmptyBatchToCycle,
  conceptsUnchangedOnFetchFailure,
  decideEmptyBatchRetry,
  EMPTY_RETRY_BACKOFF_MS,
  EMPTY_RETRY_RESET_REASONS,
  initialEmptyRetryCycle,
  MAX_EMPTY_RETRY_ATTEMPTS,
  resetEmptyRetryCycleState,
  type EmptyRetryCycleState,
  type EmptyRetryResetReason,
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
});

describe('applyEmptyBatchToCycle', () => {
  it('walks the full 1.5/3/6 cycle then marks exhausted', () => {
    let cycle = initialEmptyRetryCycle();
    const delays: number[] = [];

    for (let i = 0; i < 3; i += 1) {
      const step = applyEmptyBatchToCycle(cycle);
      assert.equal(step.decision.action, 'schedule');
      if (step.decision.action === 'schedule') delays.push(step.decision.delayMs);
      cycle = step.cycle;
      assert.equal(cycle.exhausted, false);
      assert.equal(cycle.attemptCount, i + 1);
    }

    assert.deepEqual(delays, [1500, 3000, 6000]);

    const done = applyEmptyBatchToCycle(cycle);
    assert.equal(done.decision.action, 'exhausted');
    assert.equal(done.cycle.exhausted, true);
    assert.ok(done.cycle.attemptCount > MAX_EMPTY_RETRY_ATTEMPTS);
  });
});

describe('resetEmptyRetryCycleState', () => {
  const exhausted: EmptyRetryCycleState = { attemptCount: 4, exhausted: true };

  for (const reason of EMPTY_RETRY_RESET_REASONS) {
    it(`clears attemptCount and exhausted on ${reason}`, () => {
      const next = resetEmptyRetryCycleState(reason);
      assert.deepEqual(next, { attemptCount: 0, exhausted: false });
      // Starting from an exhausted cycle, every AC reset reason must clear it.
      assert.notDeepEqual(next, exhausted);
    });
  }

  it('requires Laterality, Complexity, Adjust, and manual forward swipe', () => {
    const required: EmptyRetryResetReason[] = [
      'laterality',
      'complexity',
      'adjust',
      'manualForwardSwipe',
    ];
    for (const reason of required) {
      assert.ok(
        (EMPTY_RETRY_RESET_REASONS as readonly string[]).includes(reason),
        `expected ${reason} in EMPTY_RETRY_RESET_REASONS`,
      );
      assert.deepEqual(resetEmptyRetryCycleState(reason), initialEmptyRetryCycle());
    }
  });

  it('rejects unknown reset reasons so call sites stay honest', () => {
    assert.throws(
      () => resetEmptyRetryCycleState('silentLateralityReduction' as EmptyRetryResetReason),
      /unknown empty-retry reset reason/,
    );
  });
});

describe('conceptsUnchangedOnFetchFailure', () => {
  it('keeps the same concepts reference and index (history never cleared)', () => {
    const concepts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const after = conceptsUnchangedOnFetchFailure(concepts, 2);
    assert.equal(after.historyCleared, false);
    assert.equal(after.concepts, concepts);
    assert.equal(after.currentIndex, 2);
    assert.equal(after.concepts.length, 3);
  });

  it('fails if a buggy caller tried to wipe the deck', () => {
    const concepts = [{ id: 'a' }, { id: 'b' }];
    const after = conceptsUnchangedOnFetchFailure(concepts, 1);
    // These assertions would fail if the helper returned [] / index 0 by mistake.
    assert.notEqual(after.concepts.length, 0);
    assert.notEqual(after.currentIndex, 0);
    assert.equal(after.historyCleared, false);
  });
});
