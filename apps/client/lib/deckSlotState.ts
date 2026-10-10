/**
 * End-of-prefetched-deck slot (ClickUp Lz-36 / 869ff5gcx).
 *
 * Forward past the buffer shows Lz-35 loading; back reveals the same last card
 * without mutating walk history; failure face is Lz-38 (out of scope here).
 */

export type DeckSlotState = 'card' | 'loading' | 'failed';

export function resolveDeckSlotState(args: {
  isLastCard: boolean;
  pendingEndDeckLoad: boolean;
  loadMoreError: boolean;
}): DeckSlotState {
  if (!args.isLastCard) return 'card';
  if (args.loadMoreError) return 'failed';
  if (args.pendingEndDeckLoad) return 'loading';
  return 'card';
}

/**
 * Back from the end-of-deck loading surface: keep the last-card index and clear
 * the pending flag so history / walk order stay untouched.
 */
export function planBackFromEndLoading(currentIndex: number): {
  nextIndex: number;
  clearPending: true;
} {
  return {
    nextIndex: Math.max(0, currentIndex),
    clearPending: true,
  };
}

/** Return-overlay index while the loading face is up (the card under the silhouette). */
export function returnOverlayIndexForEndLoading(currentIndex: number): number {
  return Math.max(0, currentIndex);
}

/**
 * When the loading face clears without a swipe intent, pick settle direction:
 * index advanced → forward (new card arrived); else → backward (back from loading).
 */
export function settleIntentAfterLoadingClear(args: {
  previousIndex: number;
  nextIndex: number;
}): 'forward' | 'backward' {
  return args.nextIndex > args.previousIndex ? 'forward' : 'backward';
}
