import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  initialConnectivityUiState,
  OFFLINE_DEBOUNCE_MS,
  OFFLINE_STATUS_MAX_MS,
  reduceConnectivityUi,
  resolveIsConnected,
  type ConnectivityUiState,
} from './connectivityStatus.ts';

function apply(
  events: Parameters<typeof reduceConnectivityUi>[1][],
  start: ConnectivityUiState = initialConnectivityUiState(),
): ConnectivityUiState {
  return events.reduce((state, event) => reduceConnectivityUi(state, event), start);
}

describe('reduceConnectivityUi', () => {
  it('starts online with nothing to announce', () => {
    assert.deepEqual(initialConnectivityUiState(), {
      offline: false,
      retrying: false,
      shouldAnnounce: false,
    });
  });

  it('goes offline once and requests a single announce', () => {
    const offline = apply([{ type: 'setOffline' }]);
    assert.deepEqual(offline, {
      offline: true,
      retrying: false,
      shouldAnnounce: true,
    });
    const again = reduceConnectivityUi(offline, { type: 'setOffline' });
    assert.equal(again, offline);
  });

  it('announces only once per offline transition', () => {
    const offline = apply([{ type: 'setOffline' }, { type: 'announceConsumed' }]);
    assert.equal(offline.shouldAnnounce, false);
    assert.equal(offline.offline, true);
    const stillOffline = reduceConnectivityUi(offline, { type: 'setOffline' });
    assert.equal(stillOffline.shouldAnnounce, false);
    const cycle = apply(
      [{ type: 'setOnline' }, { type: 'setOffline' }],
      stillOffline,
    );
    assert.equal(cycle.shouldAnnounce, true);
  });

  it('clears offline and retrying when online', () => {
    const cleared = apply([
      { type: 'setOffline' },
      { type: 'retry' },
      { type: 'setOnline' },
    ]);
    assert.deepEqual(cleared, {
      offline: false,
      retrying: false,
      shouldAnnounce: false,
    });
  });

  it('tracks retrying and clears status on success', () => {
    const retrying = apply([{ type: 'setOffline' }, { type: 'retry' }]);
    assert.equal(retrying.retrying, true);
    assert.equal(retrying.offline, true);
    const success = reduceConnectivityUi(retrying, { type: 'retrySucceeded' });
    assert.deepEqual(success, {
      offline: false,
      retrying: false,
      shouldAnnounce: false,
    });
  });

  it('keeps offline after retry failure without re-announcing', () => {
    const failed = apply([
      { type: 'setOffline' },
      { type: 'announceConsumed' },
      { type: 'retry' },
      { type: 'retryFailed' },
    ]);
    assert.deepEqual(failed, {
      offline: true,
      retrying: false,
      shouldAnnounce: false,
    });
  });

  it('ignores retry while online', () => {
    const start = initialConnectivityUiState();
    assert.equal(reduceConnectivityUi(start, { type: 'retry' }), start);
  });
});

describe('resolveIsConnected', () => {
  it('prefers NetInfo when known', () => {
    assert.equal(resolveIsConnected(false, true), false);
    assert.equal(resolveIsConnected(true, false), true);
  });

  it('falls back to navigator.onLine when NetInfo is unknown', () => {
    assert.equal(resolveIsConnected(null, false), false);
    assert.equal(resolveIsConnected(undefined, true), true);
  });

  it('defaults optimistic online when both are unknown', () => {
    assert.equal(resolveIsConnected(null, null), true);
    assert.equal(resolveIsConnected(undefined, undefined), true);
  });
});

describe('offline timing tokens', () => {
  it('debounces offline under the 2 s acceptance ceiling', () => {
    assert.ok(OFFLINE_DEBOUNCE_MS > 0);
    assert.ok(OFFLINE_DEBOUNCE_MS < OFFLINE_STATUS_MAX_MS);
    assert.equal(OFFLINE_STATUS_MAX_MS, 2000);
  });
});
