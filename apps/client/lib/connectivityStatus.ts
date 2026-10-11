/**
 * Pure UI reducer for Lz-37 offline status line.
 * Connectivity sampling (NetInfo / navigator.onLine) lives in useConnectivity.
 */

export type ConnectivityUiState = {
  offline: boolean;
  retrying: boolean;
  /** True once on offline transition; consume after a polite announce. */
  shouldAnnounce: boolean;
};

export type ConnectivityEvent =
  | { type: 'setOnline' }
  | { type: 'setOffline' }
  | { type: 'retry' }
  | { type: 'retrySucceeded' }
  | { type: 'retryFailed' }
  | { type: 'announceConsumed' };

export function initialConnectivityUiState(): ConnectivityUiState {
  return { offline: false, retrying: false, shouldAnnounce: false };
}

export function reduceConnectivityUi(
  state: ConnectivityUiState,
  event: ConnectivityEvent,
): ConnectivityUiState {
  switch (event.type) {
    case 'setOffline': {
      if (state.offline) {
        return state.retrying ? { ...state, retrying: false } : state;
      }
      return { offline: true, retrying: false, shouldAnnounce: true };
    }
    case 'setOnline': {
      if (!state.offline && !state.retrying && !state.shouldAnnounce) {
        return state;
      }
      return { offline: false, retrying: false, shouldAnnounce: false };
    }
    case 'retry': {
      if (!state.offline) return state;
      if (state.retrying) return state;
      return { ...state, retrying: true };
    }
    case 'retrySucceeded': {
      // Successful refetch clears the offline line (AC); NetInfo may re-assert offline.
      return { offline: false, retrying: false, shouldAnnounce: false };
    }
    case 'retryFailed': {
      if (!state.offline && !state.retrying) return state;
      return { offline: true, retrying: false, shouldAnnounce: false };
    }
    case 'announceConsumed': {
      if (!state.shouldAnnounce) return state;
      return { ...state, shouldAnnounce: false };
    }
    default: {
      return state;
    }
  }
}

/**
 * Resolve NetInfo `isConnected` with a navigator.onLine fallback when unknown.
 * Best effort: `onLine === true` does not guarantee reachability.
 */
export function resolveIsConnected(
  netInfoConnected: boolean | null | undefined,
  navigatorOnline: boolean | null | undefined,
): boolean {
  if (netInfoConnected === true) return true;
  if (netInfoConnected === false) return false;
  if (navigatorOnline === false) return false;
  if (navigatorOnline === true) return true;
  // Optimistic default when both are unknown — keep Retry once we learn we are offline.
  return true;
}

/** Debounce before committing offline so flaky blips settle; must stay under the 2 s AC. */
export const OFFLINE_DEBOUNCE_MS = 300;

/** Hard ceiling for the airplane-mode acceptance criterion. */
export const OFFLINE_STATUS_MAX_MS = 2000;
