import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { STATUS_SLOT_MIN_WIDTH } from '@/lib/lateralityChrome';
import { beginSoundAnnouncement, endSoundAnnouncement } from '@/lib/sound';
import { runAccessibilityAnnounce } from '@/lib/soundAnnounce';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

const OFFLINE_DOT_SIZE = 8;
/** Retry / Adjust hit target ≥48 px (guide recommended touch). */
const ACTION_HIT = layout.recommendedTouchTarget;

type DeckStatusLineProps = {
  /** i18n status copy. Null hides the loading / message-only face. */
  message: string | null;
  /** Lz-37: offline face replaces loading copy in the shared slot. */
  offline?: boolean;
  offlineLabel?: string;
  /** Action label for Retry (offline / fetchFailed) or Adjust (noNextIdea). */
  actionLabel?: string;
  onAction?: () => void;
  /** testID for the action control (defaults to deck-status-retry). */
  actionTestID?: string;
  /** When true, announce offline once (polite); caller clears via onOfflineAnnounced. */
  shouldAnnounceOffline?: boolean;
  onOfflineAnnounced?: () => void;
};

/**
 * Status line in the laterality status band (Lz-35; shared for Lz-37 / Lz-38).
 * Full-width, left-aligned row above the Laterality label — never beside it,
 * never an absolute overlay. Loading: wraps; does not truncate.
 * Offline / failure / no-next: copy + action inline (or wrapped below).
 */
export function DeckStatusLine({
  message,
  offline = false,
  offlineLabel,
  actionLabel,
  onAction,
  actionTestID = 'deck-status-retry',
  shouldAnnounceOffline = false,
  onOfflineAnnounced,
}: DeckStatusLineProps) {
  const announcedStatusRef = useRef<string | null>(null);
  const announcedOfflineRef = useRef(false);

  const announceKey =
    offline && offlineLabel
      ? `offline:${offlineLabel}`
      : message != null && message !== ''
        ? message
        : null;

  useEffect(() => {
    if (offline) {
      announcedStatusRef.current = null;
      return;
    }
    if (announceKey == null) {
      announcedStatusRef.current = null;
      return;
    }
    if (announcedStatusRef.current === announceKey) return;
    announcedStatusRef.current = announceKey;
    // Suppress reshuffle SFX while VoiceOver/TalkBack speaks status copy (Sound 7 hooks).
    return runAccessibilityAnnounce(announceKey, {
      announce: (msg) => {
        AccessibilityInfo.announceForAccessibility?.(msg);
      },
      begin: beginSoundAnnouncement,
      end: endSoundAnnouncement,
    });
  }, [announceKey, offline]);

  useEffect(() => {
    if (!offline || !shouldAnnounceOffline || offlineLabel == null || offlineLabel === '') {
      if (!offline) announcedOfflineRef.current = false;
      return;
    }
    if (announcedOfflineRef.current) return;
    announcedOfflineRef.current = true;
    const dispose = runAccessibilityAnnounce(offlineLabel, {
      announce: (msg) => {
        AccessibilityInfo.announceForAccessibility?.(msg);
      },
      begin: beginSoundAnnouncement,
      end: endSoundAnnouncement,
    });
    onOfflineAnnounced?.();
    return dispose;
  }, [offline, shouldAnnounceOffline, offlineLabel, onOfflineAnnounced]);

  const actionHitSlop = Math.max(0, Math.floor((ACTION_HIT - 20) / 2));

  if (offline && offlineLabel != null && offlineLabel !== '' && actionLabel != null && onAction) {
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
        <View style={styles.actionRow}>
          <View
            style={styles.dot}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text
            style={[styles.copy, styles.flexibleCopy, textStyle('meta')]}
            accessibilityRole="text"
            accessibilityLabel={offlineLabel}
          >
            {offlineLabel}
          </Text>
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={actionHitSlop}
            style={({ pressed }) => [
              styles.actionHit,
              pressed ? styles.actionPressed : null,
            ]}
            testID={actionTestID}
          >
            <Text style={[styles.actionText, textStyle('meta', { fontWeight: '600' })]}>
              {actionLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Lz-38: fetchFailed + Retry / noNextIdea + Adjust — control row only, never on the card.
  if (message != null && message !== '' && actionLabel != null && onAction) {
    return (
      <View
        style={styles.slot}
        accessibilityLiveRegion="polite"
        testID="deck-status-line"
      >
        <View style={styles.actionRow}>
          <Text
            style={[styles.copy, styles.flexibleCopy, textStyle('meta')]}
            accessibilityRole="text"
            accessibilityLabel={message}
          >
            {message}
          </Text>
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={actionHitSlop}
            style={({ pressed }) => [
              styles.actionHit,
              pressed ? styles.actionPressed : null,
            ]}
            testID={actionTestID}
          >
            <Text style={[styles.actionText, textStyle('meta', { fontWeight: '600' })]}>
              {actionLabel}
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
  /** Fills the LateralityControl status band (full width, left-aligned). */
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
  flexibleCopy: {
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Inline when width allows; action drops to the next line rather than
    // squeezing ES copy into a narrow column beside Laterality (AD #119).
    flexWrap: 'wrap',
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
  actionHit: {
    // Touch ≥48 px comes from hitSlop; intrinsic width follows the label.
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionText: {
    color: color.paper,
    textDecorationLine: 'underline',
  },
});
