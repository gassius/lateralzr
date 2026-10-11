import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ACCESSIBLE_NAV_ROW_HEIGHT,
  ACCESSIBLE_NAV_TARGET_PX,
  type CardAction,
} from '@/lib/cardActions';
import { t, type MessageKey } from '@/lib/i18n';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

type NavItem = {
  action: CardAction;
  labelKey: MessageKey;
  testID: string;
  /** Short visible glyph; accessible name comes from labelKey. */
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
  /** End-of-deck status — disable forward / complexity / flip. */
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
  return (
    <View
      style={styles.row}
      testID="accessible-nav-row"
    >
      {NAV_ITEMS.map((item) => {
        const previousDisabled = item.action === 'previous' && currentIndex <= 0;
        const deckBlocked =
          showDeckStatus &&
          (item.action === 'next' ||
            item.action === 'flip' ||
            item.action === 'complexityUp' ||
            item.action === 'complexityDown');
        const disabled = sheetOpen || previousDisabled || deckBlocked;
        const label = t(item.labelKey);
        return (
          <Pressable
            key={item.action}
            testID={item.testID}
            onPress={() => {
              if (disabled) return;
              onAction(item.action);
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            style={({ pressed }) => [
              styles.button,
              disabled ? styles.buttonDisabled : null,
              pressed && !disabled ? styles.buttonPressed : null,
            ]}
          >
            <Text style={[styles.glyph, textStyle('label')]} accessibilityElementsHidden>
              {item.glyph}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ACCESSIBLE_NAV_ROW_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenGutter,
    gap: 4,
  },
  button: {
    width: ACCESSIBLE_NAV_TARGET_PX,
    height: ACCESSIBLE_NAV_TARGET_PX,
    minWidth: ACCESSIBLE_NAV_TARGET_PX,
    minHeight: ACCESSIBLE_NAV_TARGET_PX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    backgroundColor: color.paper,
    opacity: 0.12,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  glyph: {
    color: color.paper,
    fontSize: 18,
    lineHeight: 22,
  },
});
