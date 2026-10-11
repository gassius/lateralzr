import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import {
  initialConnectivityUiState,
  OFFLINE_DEBOUNCE_MS,
  reduceConnectivityUi,
  resolveIsConnected,
  type ConnectivityUiState,
} from '@/lib/connectivityStatus';

function readNavigatorOnline(): boolean | null {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return null;
  }
  return navigator.onLine;
}

function connectedFromNetInfo(state: NetInfoState): boolean {
  return resolveIsConnected(state.isConnected, readNavigatorOnline());
}

/**
 * Debounced connectivity for the Lz-37 offline status line.
 * Uses NetInfo; when `isConnected` is unknown, falls back to navigator.onLine
 * + window online/offline events (best effort — keep Retry).
 */
export function useConnectivity(): {
  offline: boolean;
  retrying: boolean;
  shouldAnnounce: boolean;
  beginRetry: () => void;
  reportRetrySucceeded: () => void;
  reportRetryFailed: () => void;
  consumeAnnounce: () => void;
} {
  const [ui, setUi] = useState<ConnectivityUiState>(initialConnectivityUiState);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef = useRef(true);

  const dispatch = useCallback((event: Parameters<typeof reduceConnectivityUi>[1]) => {
    setUi((prev) => reduceConnectivityUi(prev, event));
  }, []);

  const applyConnected = useCallback(
    (connected: boolean) => {
      if (connected) {
        connectedRef.current = true;
        if (offlineTimerRef.current != null) {
          clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = null;
        }
        dispatch({ type: 'setOnline' });
        return;
      }

      if (connectedRef.current === false && offlineTimerRef.current == null) {
        dispatch({ type: 'setOffline' });
        return;
      }

      connectedRef.current = false;
      if (offlineTimerRef.current != null) return;
      offlineTimerRef.current = setTimeout(() => {
        offlineTimerRef.current = null;
        dispatch({ type: 'setOffline' });
      }, OFFLINE_DEBOUNCE_MS);
    },
    [dispatch],
  );

  useEffect(() => {
    let cancelled = false;

    void NetInfo.fetch().then((state) => {
      if (cancelled) return;
      applyConnected(connectedFromNetInfo(state));
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      applyConnected(connectedFromNetInfo(state));
    });

    const syncFromBrowser = (navigatorOnline: boolean) => {
      void NetInfo.fetch().then((state) => {
        if (cancelled) return;
        if (state.isConnected == null) {
          applyConnected(resolveIsConnected(null, navigatorOnline));
          return;
        }
        applyConnected(connectedFromNetInfo(state));
      });
    };

    const onBrowserOnline = () => syncFromBrowser(true);
    const onBrowserOffline = () => syncFromBrowser(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onBrowserOnline);
      window.addEventListener('offline', onBrowserOffline);
    }

    return () => {
      cancelled = true;
      unsubscribe();
      if (offlineTimerRef.current != null) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onBrowserOnline);
        window.removeEventListener('offline', onBrowserOffline);
      }
    };
  }, [applyConnected]);

  const beginRetry = useCallback(() => {
    dispatch({ type: 'retry' });
  }, [dispatch]);

  const reportRetrySucceeded = useCallback(() => {
    dispatch({ type: 'retrySucceeded' });
  }, [dispatch]);

  const reportRetryFailed = useCallback(() => {
    dispatch({ type: 'retryFailed' });
  }, [dispatch]);

  const consumeAnnounce = useCallback(() => {
    dispatch({ type: 'announceConsumed' });
  }, [dispatch]);

  return {
    offline: ui.offline,
    retrying: ui.retrying,
    shouldAnnounce: ui.shouldAnnounce,
    beginRetry,
    reportRetrySucceeded,
    reportRetryFailed,
    consumeAnnounce,
  };
}
