import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
  withAppMenuRowPress,
  type AppMenuFeatures,
  type AppMenuRowDef,
  type AppMenuView,
} from '@/lib/appMenu';
import {
  localeDisplayKey,
  SUPPORTED_LOCALES,
  t,
  type AppLocale,
} from '@/lib/i18n';
import { LATERALITY_SHEET_ROW_MIN_HEIGHT } from '@/lib/lateralitySheet';
import { focusSheetHost } from '@/lib/sheetFocus';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

const RADIO_SIZE = 22;
const RADIO_DOT = 8;

type AppMenuSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Restart discovery coaching (Lz-48 sequence) then caller closes. */
  onReplayGestureTips: () => void;
  /** Active UI/content locale (drives Language row value + radio selection). */
  locale: AppLocale;
  /** Persist + apply a new locale; keep current card/history. */
  onSelectLocale: (locale: AppLocale) => void;
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

function LanguageRadio({ checked }: { checked: boolean }) {
  return (
    <View
      style={[
        styles.radio,
        checked ? styles.radioChecked : styles.radioUnchecked,
      ]}
      accessible={false}
    >
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

function AppMenuRow({
  row,
  showDivider,
  onPress,
  rowRef,
}: {
  row: AppMenuRowDef;
  showDivider: boolean;
  onPress: () => void;
  rowRef?: RefObject<ViewType | null>;
}) {
  const showChevron = appMenuRowShowsChevron(row);
  const a11y = appMenuRowA11yLabel(row, t);
  const valueText = row.value ?? (row.valueKey != null ? t(row.valueKey) : null);

  return (
    <View ref={rowRef}>
      {showDivider ? <View style={styles.divider} testID={`app-menu-divider-${row.key}`} /> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        testID={`app-menu-row-${row.key}`}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <Text style={[styles.rowLabel, textStyle('row')]}>{t(row.labelKey)}</Text>
        {valueText ? (
          <Text
            style={styles.rowValue}
            testID={`app-menu-row-value-${row.key}`}
          >
            {valueText}
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
 * General app menu sheet (guide §12.2). Language picker (Lz-44) + Replay tips;
 * later rows (Lz-45…47) plug into the same row model / in-sheet view state.
 */
export function AppMenuSheet({
  visible,
  onDismiss,
  onReplayGestureTips,
  locale,
  onSelectLocale,
  returnFocusRef,
  features = DEFAULT_APP_MENU_FEATURES,
}: AppMenuSheetProps) {
  const [view, setView] = useState<AppMenuView>('root');
  const languageRowRef = useRef<ViewType | null>(null);

  const rows = useMemo(
    () =>
      withAppMenuRowPress(visibleAppMenuRows(features), {
        language: () => setView('language'),
        replayTips: () => {
          onReplayGestureTips();
          onDismiss();
        },
      }).map((row) => {
        if (row.key !== 'language') return row;
        return {
          ...row,
          valueKey: localeDisplayKey(locale),
        };
      }),
    [features, locale, onDismiss, onReplayGestureTips],
  );

  useEffect(() => {
    if (!visible) setView('root');
  }, [visible]);

  const onRowPress = (row: AppMenuRowDef) => {
    if (row.onPress) {
      row.onPress();
      return;
    }
    if (row.opensView && row.key === 'language') {
      setView('language');
    }
  };

  const goBackToRoot = () => {
    setView('root');
    // Best-effort: return focus to the Language row after the view swaps.
    requestAnimationFrame(() => focusSheetHost(languageRowRef));
  };

  const sheetTitle = view === 'language' ? t('menuLanguage') : t('menuTitle');

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      title={sheetTitle}
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
              rowRef={row.key === 'language' ? languageRowRef : undefined}
            />
          ))}
        </View>
      ) : null}
      {view === 'language' ? (
        <View style={styles.languageView} testID="app-menu-language">
          <Pressable
            onPress={goBackToRoot}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            testID="app-menu-back"
            style={({ pressed }) => [styles.backRow, pressed ? styles.rowPressed : null]}
          >
            <Text style={[styles.backLabel, textStyle('row')]}>{t('back')}</Text>
          </Pressable>
          <View style={styles.languageList} testID="app-menu-language-rows">
            {SUPPORTED_LOCALES.map((option) => {
              const checked = option === locale;
              const label = t(localeDisplayKey(option));
              return (
                <Pressable
                  key={option}
                  onPress={() => onSelectLocale(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  accessibilityLabel={label}
                  testID={`app-menu-language-row-${option}`}
                  style={({ pressed }) => [
                    styles.languageRow,
                    checked ? styles.languageRowSelected : null,
                    pressed ? styles.rowPressed : null,
                  ]}
                >
                  <LanguageRadio checked={checked} />
                  <Text
                    style={[
                      styles.languageRowLabel,
                      textStyle('row'),
                      checked ? styles.languageRowLabelSelected : null,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
  languageView: {
    paddingBottom: 8,
    gap: 8,
  },
  backRow: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 12,
  },
  backLabel: {
    color: color.ink,
  },
  languageList: {
    gap: 4,
  },
  /** Mirror LateralitySheet radio rows (Lz-31). */
  languageRow: {
    minHeight: LATERALITY_SHEET_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  languageRowSelected: {
    backgroundColor: color.selectedSoft,
  },
  languageRowLabel: {
    flex: 1,
    color: color.ink,
  },
  languageRowLabelSelected: {
    color: color.ink,
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnchecked: {
    borderColor: color.controlBorder,
    backgroundColor: 'transparent',
  },
  radioChecked: {
    borderColor: color.front,
    backgroundColor: color.front,
  },
  radioDot: {
    width: RADIO_DOT,
    height: RADIO_DOT,
    borderRadius: RADIO_DOT / 2,
    backgroundColor: color.ink,
  },
});
