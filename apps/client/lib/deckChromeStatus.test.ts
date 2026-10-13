import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveDeckChromeStatus } from './deckChromeStatus.ts';

const base = {
  offline: false,
  noNextIdea: false,
  loadMoreError: false,
  lateralitySwapping: false,
  showInitialLoading: false,
  showDeckLoading: false,
};

describe('resolveDeckChromeStatus', () => {
  it('returns none when idle', () => {
    assert.deepEqual(resolveDeckChromeStatus(base), { kind: 'none' });
  });

  it('prefers offline over every other face', () => {
    assert.deepEqual(
      resolveDeckChromeStatus({
        ...base,
        offline: true,
        noNextIdea: true,
        loadMoreError: true,
        lateralitySwapping: true,
        showDeckLoading: true,
      }),
      { kind: 'offline' },
    );
  });

  it('prefers noNextIdea over fetchFailed and loading', () => {
    assert.deepEqual(
      resolveDeckChromeStatus({
        ...base,
        noNextIdea: true,
        loadMoreError: true,
        showDeckLoading: true,
      }),
      { kind: 'noNextIdea' },
    );
  });

  it('shows fetchFailed in the control row (not on the card)', () => {
    assert.deepEqual(
      resolveDeckChromeStatus({ ...base, loadMoreError: true }),
      { kind: 'fetchFailed' },
    );
  });

  it('shows neighbourhood loading while laterality swaps', () => {
    assert.deepEqual(
      resolveDeckChromeStatus({ ...base, lateralitySwapping: true }),
      { kind: 'neighbourhoodLoading' },
    );
  });

  it('shows findingStart then loadingMore', () => {
    assert.deepEqual(
      resolveDeckChromeStatus({ ...base, showInitialLoading: true }),
      { kind: 'findingStart' },
    );
    assert.deepEqual(
      resolveDeckChromeStatus({ ...base, showDeckLoading: true }),
      { kind: 'loadingMore' },
    );
  });
});
