import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planBackFromEndLoading,
  resolveDeckSlotState,
  returnOverlayIndexForEndLoading,
  settleIntentAfterLoadingClear,
} from './deckSlotState.ts';

describe('resolveDeckSlotState', () => {
  it('stays on card mid-deck', () => {
    assert.equal(
      resolveDeckSlotState({
        isLastCard: false,
        pendingEndDeckLoad: true,
        loadMoreError: false,
      }),
      'card',
    );
  });

  it('shows loading when pending at the true end', () => {
    assert.equal(
      resolveDeckSlotState({
        isLastCard: true,
        pendingEndDeckLoad: true,
        loadMoreError: false,
      }),
      'loading',
    );
  });

  it('prefers failed over loading (Lz-38 surface)', () => {
    assert.equal(
      resolveDeckSlotState({
        isLastCard: true,
        pendingEndDeckLoad: true,
        loadMoreError: true,
      }),
      'failed',
    );
  });
});

describe('planBackFromEndLoading', () => {
  it('keeps the last-card index and clears pending', () => {
    assert.deepEqual(planBackFromEndLoading(3), {
      nextIndex: 3,
      clearPending: true,
    });
  });

  it('works on a single-card deck (index 0)', () => {
    assert.deepEqual(planBackFromEndLoading(0), {
      nextIndex: 0,
      clearPending: true,
    });
  });
});

describe('returnOverlayIndexForEndLoading', () => {
  it('points at the card under the silhouette', () => {
    assert.equal(returnOverlayIndexForEndLoading(2), 2);
    assert.equal(returnOverlayIndexForEndLoading(0), 0);
  });
});

describe('settleIntentAfterLoadingClear', () => {
  it('settles forward when the next card arrives', () => {
    assert.equal(
      settleIntentAfterLoadingClear({ previousIndex: 0, nextIndex: 1 }),
      'forward',
    );
  });

  it('settles backward when backtracking off loading', () => {
    assert.equal(
      settleIntentAfterLoadingClear({ previousIndex: 2, nextIndex: 2 }),
      'backward',
    );
  });
});
