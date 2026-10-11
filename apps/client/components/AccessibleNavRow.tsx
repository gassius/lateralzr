import { useLayoutEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ACCESSIBLE_NAV_ROW_MIN_HEIGHT,
  ACCESSIBLE_NAV_TARGET_PX,
  ensureA11yFocusRingStyles,
  isCardActionDisabled,
  navButtonA11yProps,
  type CardAction,
  type CardActionGate,
} from '@/lib/cardActions';
import { t, type MessageKey } from '@/lib/i18n';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

type NavItem = {
  action: CardAction;
  labelKey: MessageKey;
  testID: string;
  /** Optional short glyph shown above the i18n label. */
  glyph: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { action: 'previous', labelKey: 'actionPrevious', testID: 'a11y-nav-previous', glyph: '←' },
  { action: 'complexityDown', labelKey: 'actionComplexityDown', testID: 'a11y-nav-complexity-down', glyph: '↓' },
  { action: 'flip', labelKey: 'actionTurn', testID: 'a11y-nav-flip', glyph: '↺' },
  { action: 'complexityUp', labelKey: 'actionComplexityUp', testID: 'a11y-nav-complexity-up', glyph: '↑' },
  { action: 'next', labelKey: 'actionNext', testID: 'a11y-nav-next', glyph: '→' },
] as const;

type AccessibleNavRowProps = {
  currentIndex: number;
  /** End-of-deck status — disable forward / complexity / flip (previous still ok). */
  showDeckStatus: boolean;
  /** Modal sheet open — all disabled. */
  sheetOpen: boolean;
  onAction: (action: CardAction) => void;
};

export function AccessibleNavRow({
  currentIndex,
  showDeckStatus,
  sheetOpen,
  onAction,
}: AccessibleNavRowProps) {
  useLayoutEffect(() => {
    if (Platform.OS === 'web') ensureA11yFocusRingStyles();
  }, []);

  const gate: CardActionGate = {
    currentIndex,
    showDeckStatus,
    sheetOpen,
  };

  return (
    <View
      style={styles.row}
      testID="accessible-nav-row"
    >
      {NAV_ITEMS.map((item) => {
        const label = t(item.labelKey);
        const a11y = navButtonA11yProps({ action: item.action, label, gate });
        const disabled = a11y.disabled;
        return (
          <Pressable
            key={item.action}
            testID={item.testID}
            onPress={() => {
              if (isCardActionDisabled(item.action, gate)) return;
              onAction(item.action);
            }}
            disabled={disabled}
            accessibilityRole={a11y.accessibilityRole}
            accessibilityLabel={a11y.accessibilityLabel}
            accessibilityState={a11y.accessibilityState}
            style={styles.button}
          >
            {({ pressed }) => (
              <>
                {pressed && !disabled ? <View style={styles.pressedTint} pointerEvents="none" /> : null}
                <Text
                  style={[
                    styles.glyph,
                    textStyle('label'),
                    disabled ? styles.labelDisabled : null,
                  ]}
                  accessibilityElementsHidden
                >
                  {item.glyph}
                </Text>
                <Text
                  style={[
                    styles.label,
                    textStyle('label'),
                    disabled ? styles.labelDisabled : null,
                  ]}
                  numberOfLines={3}
                >
                  {label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ACCESSIBLE_NAV_ROW_MIN_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenGutter,
    gap: 4,
  },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: ACCESSIBLE_NAV_TARGET_PX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
    paddingVertical: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  pressedTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.paper,
    opacity: 0.12,
  },
  glyph: {
    color: color.paper,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  label: {
    color: color.paper,
    textAlign: 'center',
    // 14/500 from textStyle('label'); allow wrap at 200% instead of truncating.
  },
  labelDisabled: {
    // Keep disabled Previous readable as part of the row (not 0.35 petrol fade).
    color: color.mutedOnShell,
    opacity: 1,
  },
});
