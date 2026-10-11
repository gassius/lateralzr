/**
 * End-of-prefetched-deck slot (ClickUp Lz-36 / 869ff5gcx).
 *
 * Forward past the buffer shows Lz-35 loading; back reveals the same last card
 * without mutating walk history; failure face is Lz-38 (out of scope here).
 */

export type DeckSlotState = 'card' | 'loading' | 'failed';

export type NavSettleIntent = 'forward' | 'backward' | 'backwardGesture';

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

/**
 * Pure reducer for HomeScreen swipe-right.
 * When pending end-deck load, clear pending and keep index (do not pop to N-1).
 */
export function reduceSwipeRight(state: {
  index: number;
  pending: boolean;
}): { index: number; pending: boolean } {
  if (state.pending) {
    const plan = planBackFromEndLoading(state.index);
    return { index: plan.nextIndex, pending: false };
  }
  return { index: Math.max(0, state.index - 1), pending: false };
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

/**
 * Unified settle-intent decision for ConceptCardStack.
 *
 * - commitFromStatus=true  → back from loading (settle 'backward')
 * - commitFromStatus=false → normal backtrack (gesture already showed peer; 'backwardGesture')
 * - layout path: honor navIntent, else derive from wasDeckStatus → loading clear
 */
export function resolveNavSettleIntent(args: {
  navIntent: NavSettleIntent | null;
  wasDeckStatus: boolean;
  showDeckStatus: boolean;
  prevIndex: number;
  index: number;
  /** Swipe-right commit only: whether the status face was up at commit time. */
  commitFromStatus?: boolean | null;
}): NavSettleIntent | null {
  if (args.commitFromStatus === true) return 'backward';
  if (args.commitFromStatus === false) return 'backwardGesture';

  if (args.navIntent) return args.navIntent;

  if (args.wasDeckStatus && !args.showDeckStatus) {
    return settleIntentAfterLoadingClear({
      previousIndex: args.prevIndex,
      nextIndex: args.index,
    });
  }

  return null;
}
