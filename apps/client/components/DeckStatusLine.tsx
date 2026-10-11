import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { STATUS_SLOT_MIN_WIDTH } from '@/lib/lateralityChrome';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

const OFFLINE_DOT_SIZE = 8;
/** Retry hit target ≥48 px (guide recommended touch). */
const RETRY_HIT = layout.recommendedTouchTarget;

type DeckStatusLineProps = {
  /** i18n status copy (`findingStart` / `loadingMoreIdeas`). Null hides the loading face. */
  message: string | null;
  /** Lz-37: offline face replaces loading copy in the shared slot. */
  offline?: boolean;
  offlineLabel?: string;
  retryLabel?: string;
  onRetry?: () => void;
  /** When true, announce offline once (polite); caller clears via onOfflineAnnounced. */
  shouldAnnounceOffline?: boolean;
  onOfflineAnnounced?: () => void;
};

/**
 * Status line on the laterality label row (Lz-35; shared slot for Lz-37).
 * In-flow left slot beside the laterality label — never an absolute overlay.
 * Loading: wraps; does not truncate. Offline: 8 px dot + copy + Retry link.
 */
export function DeckStatusLine({
  message,
  offline = false,
  offlineLabel,
  retryLabel,
  onRetry,
  shouldAnnounceOffline = false,
  onOfflineAnnounced,
}: DeckStatusLineProps) {
  const announcedStatusRef = useRef<string | null>(null);
  const announcedOfflineRef = useRef(false);

  useEffect(() => {
    if (offline) {
      announcedStatusRef.current = null;
      return;
    }
    if (message == null || message === '') {
      announcedStatusRef.current = null;
      return;
    }
    if (announcedStatusRef.current === message) return;
    announcedStatusRef.current = message;
    AccessibilityInfo.announceForAccessibility?.(message);
  }, [message, offline]);

  useEffect(() => {
    if (!offline || !shouldAnnounceOffline || offlineLabel == null || offlineLabel === '') {
      if (!offline) announcedOfflineRef.current = false;
      return;
    }
    if (announcedOfflineRef.current) return;
    announcedOfflineRef.current = true;
    AccessibilityInfo.announceForAccessibility?.(offlineLabel);
    onOfflineAnnounced?.();
  }, [offline, shouldAnnounceOffline, offlineLabel, onOfflineAnnounced]);

  if (offline && offlineLabel != null && offlineLabel !== '' && retryLabel != null && onRetry) {
    return (
      <View
        style={styles.slot}
        accessibilityLiveRegion="polite"
        testID="deck-status-line"
      >
        {/*
          One nowrap unit (dot + copy + Retry). AD #104: at 390 ES, Reintentar must
          stay on the same row as Sin conexión — never orphan beside laterality.
          ≥48 px hit via hitSlop (not minWidth, which forced the wrap).
        */}
        <View style={styles.offlineRow}>
          <View
            style={styles.dot}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text
            style={[styles.copy, styles.offlineCopy, textStyle('meta')]}
            accessibilityRole="text"
            accessibilityLabel={offlineLabel}
          >
            {offlineLabel}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
            hitSlop={Math.max(0, Math.floor((RETRY_HIT - 20) / 2))}
            style={({ pressed }) => [
              styles.retryHit,
              pressed ? styles.retryPressed : null,
            ]}
            testID="deck-status-retry"
          >
            <Text style={[styles.retryText, textStyle('meta', { fontWeight: '600' })]}>
              {retryLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (message == null || message === '') {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.slot}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityLabel={message}
      testID="deck-status-line"
    >
      <Text style={[styles.copy, textStyle('meta')]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Fills the LateralityControl statusSlot; min width matches the host slot. */
  slot: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: STATUS_SLOT_MIN_WIDTH,
    justifyContent: 'center',
  },
  copy: {
    color: color.mutedOnShell,
    textAlign: 'left',
  },
  offlineCopy: {
    flexShrink: 1,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    flexShrink: 1,
    gap: 6,
  },
  dot: {
    width: OFFLINE_DOT_SIZE,
    height: OFFLINE_DOT_SIZE,
    borderRadius: OFFLINE_DOT_SIZE / 2,
    backgroundColor: color.mutedOnShell,
    flexShrink: 0,
  },
  retryHit: {
    // Touch ≥48 px comes from hitSlop; intrinsic width follows the label so ES
    // "Reintentar" stays on one row with "Sin conexión" at 390 (AD #104).
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    color: color.paper,
    textDecorationLine: 'underline',
  },
});
