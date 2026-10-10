import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Sheet } from '@/components/Sheet';
import {
  APP_MENU_ROW_MIN_HEIGHT,
  APP_MENU_VALUE_FONT_SIZE,
  APP_MENU_VALUE_LINE_HEIGHT,
  appMenuRowA11yLabel,
  appMenuRowShowsChevron,
  DEFAULT_APP_MENU_FEATURES,
  visibleAppMenuRows,
  type AppMenuFeatures,
  type AppMenuRowDef,
  type AppMenuView,
} from '@/lib/appMenu';
import { t } from '@/lib/i18n';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

type AppMenuSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Restart discovery coaching (Lz-48 sequence) then caller closes. */
  onReplayGestureTips: () => void;
  returnFocusRef?: RefObject<ViewType | null>;
  features?: AppMenuFeatures;
};

function ChevronRight({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
      <Polyline
        points="9 6 15 12 9 18"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AppMenuRow({
  row,
  showDivider,
  onPress,
}: {
  row: AppMenuRowDef;
  showDivider: boolean;
  onPress: () => void;
}) {
  const showChevron = appMenuRowShowsChevron(row);
  const a11y = appMenuRowA11yLabel(row, t);

  return (
    <View>
      {showDivider ? <View style={styles.divider} testID={`app-menu-divider-${row.key}`} /> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        testID={`app-menu-row-${row.key}`}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <Text style={[styles.rowLabel, textStyle('row')]}>{t(row.labelKey)}</Text>
        {row.valueKey ? (
          <Text
            style={styles.rowValue}
            testID={`app-menu-row-value-${row.key}`}
          >
            {t(row.valueKey)}
          </Text>
        ) : null}
        {showChevron ? (
          <View testID={`app-menu-row-chevron-${row.key}`} accessible={false}>
            <ChevronRight stroke={color.mutedOnPaper} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * General app menu sheet (guide §12.2). v3.3 ships Replay gesture tips only;
 * later rows (Lz-44…47) plug into the same row model / in-sheet view state.
 */
export function AppMenuSheet({
  visible,
  onDismiss,
  onReplayGestureTips,
  returnFocusRef,
  features = DEFAULT_APP_MENU_FEATURES,
}: AppMenuSheetProps) {
  const [view, setView] = useState<AppMenuView>('root');
  const rows = useMemo(() => visibleAppMenuRows(features), [features]);

  useEffect(() => {
    if (!visible) setView('root');
  }, [visible]);

  const onRowPress = (row: AppMenuRowDef) => {
    if (row.key === 'replayTips') {
      onReplayGestureTips();
      onDismiss();
      return;
    }
    // Nested views (language / …) land with their feature tickets.
    if (row.opensView) {
      // Reserved: setView(row.key) when those views ship.
      return;
    }
  };

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      title={t('menuTitle')}
      testID="app-menu"
      titleTestID="app-menu-title"
      closeTestID="app-menu-close"
      returnFocusRef={returnFocusRef}
    >
      {view === 'root' ? (
        <View style={styles.list} testID="app-menu-rows">
          {rows.map((row, index) => (
            <AppMenuRow
              key={row.key}
              row={row}
              showDivider={index > 0}
              onPress={() => onRowPress(row)}
            />
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  /** Content-height list — do not stretch the short one-row sheet. */
  list: {
    paddingBottom: 8,
  },
  row: {
    minHeight: APP_MENU_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    color: color.ink,
  },
  rowValue: {
    color: color.mutedOnPaper,
    fontSize: APP_MENU_VALUE_FONT_SIZE,
    lineHeight: APP_MENU_VALUE_LINE_HEIGHT,
    fontWeight: '400',
    flexShrink: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.divider,
  },
});
