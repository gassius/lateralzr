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

/** Reset triggers: Laterality / Complexity change, Adjust, manual forward swipe. */
export function shouldResetEmptyRetryCounter(
  reason:
    | 'laterality'
    | 'complexity'
    | 'adjust'
    | 'manualForwardSwipe'
    | 'successfulAppend'
    | 'manualRetry',
): boolean {
  switch (reason) {
    case 'laterality':
    case 'complexity':
    case 'adjust':
    case 'manualForwardSwipe':
    case 'successfulAppend':
    case 'manualRetry':
      return true;
    default:
      return false;
  }
}

/**
 * Fetch failure keeps the walk intact — never clears concepts or index (Lz-38 AC).
 */
export function deckAfterFetchFailure<T>(deck: {
  concepts: readonly T[];
  currentIndex: number;
}): { concepts: readonly T[]; currentIndex: number } {
  return {
    concepts: deck.concepts,
    currentIndex: deck.currentIndex,
  };
}
