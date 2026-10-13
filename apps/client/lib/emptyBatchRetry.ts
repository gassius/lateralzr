/**
 * Lz-38 bounded empty-batch retry (§12.4).
 * Replaces the unbounded 1.5s → 30s loop with at most three scheduled
 * retries (1.5s, 3s, 6s). After the cycle exhausts, the UI shows No next idea.
 */

export const EMPTY_RETRY_BACKOFF_MS = [1500, 3000, 6000] as const;

/** Max empty results that still schedule a retry (one per backoff slot). */
export const MAX_EMPTY_RETRY_ATTEMPTS = EMPTY_RETRY_BACKOFF_MS.length;

export type EmptyBatchRetryDecision =
  | { action: 'schedule'; delayMs: number; attemptCount: number }
  | { action: 'exhausted'; attemptCount: number };

/**
 * Decide what to do after an empty load-more batch.
 * `priorEmptyCount` is how many empties this cycle has already recorded (0 on first).
 */
export function decideEmptyBatchRetry(priorEmptyCount: number): EmptyBatchRetryDecision {
  const attemptCount = Math.max(0, priorEmptyCount) + 1;
  if (attemptCount > MAX_EMPTY_RETRY_ATTEMPTS) {
    return { action: 'exhausted', attemptCount };
  }
  const delayMs = EMPTY_RETRY_BACKOFF_MS[attemptCount - 1]!;
  return { action: 'schedule', delayMs, attemptCount };
}

/** Reasons that clear the empty-retry counter (Lz-38 AC). */
export const EMPTY_RETRY_RESET_REASONS = [
  'laterality',
  'complexity',
  'adjust',
  'manualForwardSwipe',
  'successfulAppend',
  'manualRetry',
  'reload',
] as const;

export type EmptyRetryResetReason = (typeof EMPTY_RETRY_RESET_REASONS)[number];

export type EmptyRetryCycleState = {
  /** Empties observed in the current cycle. */
  attemptCount: number;
  /** True after the bounded cycle stops (No next idea). */
  exhausted: boolean;
};

export function initialEmptyRetryCycle(): EmptyRetryCycleState {
  return { attemptCount: 0, exhausted: false };
}

/**
 * Apply an empty-batch outcome to the cycle.
 * Returns the next cycle state plus whether to schedule a retry or stop.
 */
export function applyEmptyBatchToCycle(cycle: EmptyRetryCycleState): {
  cycle: EmptyRetryCycleState;
  decision: EmptyBatchRetryDecision;
} {
  const decision = decideEmptyBatchRetry(cycle.attemptCount);
  if (decision.action === 'exhausted') {
    return {
      cycle: { attemptCount: decision.attemptCount, exhausted: true },
      decision,
    };
  }
  return {
    cycle: { attemptCount: decision.attemptCount, exhausted: false },
    decision,
  };
}

/**
 * Clear the empty-retry cycle. Only the documented reset reasons are accepted —
 * unknown values throw so call sites stay honest.
 */
export function resetEmptyRetryCycleState(
  reason: EmptyRetryResetReason,
): EmptyRetryCycleState {
  if (!(EMPTY_RETRY_RESET_REASONS as readonly string[]).includes(reason)) {
    throw new Error(`unknown empty-retry reset reason: ${String(reason)}`);
  }
  return initialEmptyRetryCycle();
}

/**
 * After a load-more network failure, keep the walk (concepts + index).
 * Used so the catch path cannot accidentally clear history.
 */
export function conceptsUnchangedOnFetchFailure<T>(
  concepts: readonly T[],
  currentIndex: number,
): { concepts: readonly T[]; currentIndex: number; historyCleared: false } {
  return {
    concepts,
    currentIndex,
    historyCleared: false,
  };
}
