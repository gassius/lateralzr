import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { STATUS_SLOT_MIN_WIDTH } from '@/lib/lateralityChrome';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

type DeckStatusLineProps = {
  /** i18n status copy (`findingStart` / `loadingMoreIdeas`). Null hides the slot. */
  message: string | null;
};

/**
 * Status line on the laterality label row (Lz-35; shared slot for Lz-37).
 * In-flow left slot beside the laterality label — never an absolute overlay.
 * Wraps; does not truncate. Announces once per distinct message via a polite live region.
 */
export function DeckStatusLine({ message }: DeckStatusLineProps) {
  const announcedRef = useRef<string | null>(null);

  useEffect(() => {
    if (message == null || message === '') {
      announcedRef.current = null;
      return;
    }
    if (announcedRef.current === message) return;
    announcedRef.current = message;
    AccessibilityInfo.announceForAccessibility?.(message);
  }, [message]);

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
});
