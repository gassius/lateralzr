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
  /** Optional short glyph shown beside the i18n label. */
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
  /** Measured row height (grows when the row wraps to 3+2). */
  onHeightChange?: (height: number) => void;
};

export function AccessibleNavRow({
  currentIndex,
  showDeckStatus,
  sheetOpen,
  onAction,
  onHeightChange,
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
      onLayout={(e) => {
        onHeightChange?.(e.nativeEvent.layout.height);
      }}
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
                <View style={styles.buttonInner} pointerEvents="none">
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
                  >
                    {label}
                  </Text>
                </View>
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
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: layout.screenGutter,
    columnGap: 4,
    rowGap: 4,
  },
  button: {
    // Three targets per line → 3+2 when five don't fit (320 / 200%).
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '30%',
    maxWidth: '33.33%',
    minHeight: ACCESSIBLE_NAV_TARGET_PX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 6,
    overflow: 'visible',
    position: 'relative',
  },
  buttonInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
    rowGap: 2,
    maxWidth: '100%',
  },
  pressedTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.paper,
    opacity: 0.12,
  },
  glyph: {
    color: color.paper,
    textAlign: 'center',
    flexShrink: 0,
  },
  label: {
    color: color.paper,
    textAlign: 'center',
    // 14/500 from textStyle('label'); wrap on word boundaries only — never mid-word / ellipsis.
    flexShrink: 1,
    ...(Platform.OS === 'web'
      ? ({
          wordBreak: 'normal',
          overflowWrap: 'normal',
          hyphens: 'none',
        } as object)
      : null),
  },
  labelDisabled: {
    // Keep disabled Previous readable as part of the row (not 0.35 petrol fade).
    color: color.mutedOnShell,
    opacity: 1,
  },
});
