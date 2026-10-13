import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planBackFromEndLoading,
  reduceSwipeRight,
  resolveDeckSlotState,
  resolveNavSettleIntent,
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

  it('prefers failed over loading (Lz-38 status-line surface)', () => {
    assert.equal(
      resolveDeckSlotState({
        isLastCard: true,
        pendingEndDeckLoad: true,
        loadMoreError: true,
      }),
      'failed',
    );
  });

  it('prefers noNextIdea over failed and loading', () => {
    assert.equal(
      resolveDeckSlotState({
        isLastCard: true,
        pendingEndDeckLoad: true,
        loadMoreError: true,
        noNextIdea: true,
      }),
      'noNextIdea',
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

describe('reduceSwipeRight', () => {
  it('from end-loading at N>0 keeps N (does not pop to N-1)', () => {
    assert.deepEqual(reduceSwipeRight({ index: 2, pending: true }), {
      index: 2,
      pending: false,
    });
  });

  it('from end-loading at index 0 keeps 0', () => {
    assert.deepEqual(reduceSwipeRight({ index: 0, pending: true }), {
      index: 0,
      pending: false,
    });
  });

  it('normal backtrack decrements index', () => {
    assert.deepEqual(reduceSwipeRight({ index: 2, pending: false }), {
      index: 1,
      pending: false,
    });
  });

  it('normal backtrack at 0 stays at 0', () => {
    assert.deepEqual(reduceSwipeRight({ index: 0, pending: false }), {
      index: 0,
      pending: false,
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

describe('resolveNavSettleIntent', () => {
  it('forward-append: loading cleared with index advanced', () => {
    assert.equal(
      resolveNavSettleIntent({
        navIntent: null,
        wasDeckStatus: true,
        showDeckStatus: false,
        prevIndex: 1,
        index: 2,
      }),
      'forward',
    );
  });

  it('back-from-loading layout: loading cleared, index unchanged', () => {
    assert.equal(
      resolveNavSettleIntent({
        navIntent: null,
        wasDeckStatus: true,
        showDeckStatus: false,
        prevIndex: 2,
        index: 2,
      }),
      'backward',
    );
  });

  it('back-from-loading commit: status face up at swipe-right', () => {
    assert.equal(
      resolveNavSettleIntent({
        navIntent: null,
        wasDeckStatus: true,
        showDeckStatus: true,
        prevIndex: 2,
        index: 2,
        commitFromStatus: true,
      }),
      'backward',
    );
  });

  it('normal backtrack commit uses backwardGesture', () => {
    assert.equal(
      resolveNavSettleIntent({
        navIntent: null,
        wasDeckStatus: false,
        showDeckStatus: false,
        prevIndex: 1,
        index: 2,
        commitFromStatus: false,
      }),
      'backwardGesture',
    );
  });

  it('honors an existing navIntent over wasDeckStatus settle', () => {
    assert.equal(
      resolveNavSettleIntent({
        navIntent: 'forward',
        wasDeckStatus: true,
        showDeckStatus: false,
        prevIndex: 2,
        index: 2,
      }),
      'forward',
    );
  });

  it('returns null when nothing changed', () => {
    assert.equal(
      resolveNavSettleIntent({
        navIntent: null,
        wasDeckStatus: false,
        showDeckStatus: false,
        prevIndex: 1,
        index: 1,
      }),
      null,
    );
  });
});
