import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from 'react-native';
import Svg, { Polyline, SvgXml } from 'react-native-svg';
import { LOGO_SVG_ON_PAPER } from '@/assets/images/logo/lateralzrLogoOnPaper';
import { Sheet } from '@/components/Sheet';
import {
  ABOUT_LOGO_WIDTH,
  APP_MENU_ROW_MIN_HEIGHT,
  APP_MENU_VALUE_FONT_SIZE,
  APP_MENU_VALUE_LINE_HEIGHT,
  appMenuRowA11yLabel,
  appMenuRowShowsChevron,
  DEFAULT_APP_MENU_FEATURES,
  focusLanguagePickerOnOpen,
  visibleAppMenuRows,
  withAppMenuRowPress,
  type AppMenuFeatures,
  type AppMenuRowDef,
  type AppMenuView,
} from '@/lib/appMenu';
import { readAppVersion } from '@/lib/appVersion';
import {
  localeDisplayKey,
  SUPPORTED_LOCALES,
  t,
  type AppLocale,
} from '@/lib/i18n';
import { LATERALITY_SHEET_ROW_MIN_HEIGHT } from '@/lib/lateralitySheet';
import { focusSheetHost } from '@/lib/sheetFocus';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

const RADIO_SIZE = 22;
const RADIO_DOT = 8;

/** viewBox from lateralzr-logo-on-paper.svg (includes clear space). */
const ABOUT_LOGO_VB_W = 342.14209;
const ABOUT_LOGO_VB_H = 310.62924;
const ABOUT_LOGO_HEIGHT = ABOUT_LOGO_WIDTH * (ABOUT_LOGO_VB_H / ABOUT_LOGO_VB_W);

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

function ChevronLeft({ stroke }: { stroke: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
      <Polyline
        points="15 6 9 12 15 18"
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

const webFocusProps =
  Platform.OS === 'web' ? ({ tabIndex: 0 } as Record<string, unknown>) : {};

function AppMenuAboutView({ onBack }: { onBack: () => void }) {
  const version = readAppVersion();
  const promise = t('aboutPromise');
  const textA11y = `${promise}, ${version}`;

  return (
    <ScrollView
      style={styles.aboutScroll}
      contentContainerStyle={styles.aboutContent}
      keyboardShouldPersistTaps="handled"
      testID="app-menu-about"
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Lateralzr"
        testID="app-menu-about-logo"
        style={styles.aboutLogo}
        {...webFocusProps}
      >
        <SvgXml
          xml={LOGO_SVG_ON_PAPER}
          width={ABOUT_LOGO_WIDTH}
          height={ABOUT_LOGO_HEIGHT}
          accessible={false}
        />
      </View>
      <View
        accessible
        accessibilityLabel={textA11y}
        testID="app-menu-about-copy"
        style={styles.aboutCopy}
        {...webFocusProps}
      >
        <Text style={[styles.aboutPromise, textStyle('body')]} accessible={false}>
          {promise}
        </Text>
        <Text style={[styles.aboutVersion, textStyle('meta')]} accessible={false}>
          {version}
        </Text>
      </View>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('menuTitle')}
        testID="app-menu-about-back"
        style={({ pressed }) => [styles.aboutBack, pressed ? styles.rowPressed : null]}
        hitSlop={4}
      >
        <ChevronLeft stroke={color.ink} />
        <Text style={[styles.aboutBackLabel, textStyle('row')]} accessible={false}>
          {t('menuTitle')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * General app menu sheet (guide §12.2). Language picker (Lz-44) + About (Lz-47)
 * + Replay tips; later rows (Lz-45…46) plug into the same row model.
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
  const languageBackRef = useRef<ViewType | null>(null);

  const rows = useMemo(
    () =>
      withAppMenuRowPress(visibleAppMenuRows(features), {
        language: () => setView('language'),
        about: () => setView('about'),
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

  useEffect(() => {
    if (view !== 'language') return;
    const frame = requestAnimationFrame(() => {
      focusLanguagePickerOnOpen(focusSheetHost, languageBackRef);
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const onRowPress = (row: AppMenuRowDef) => {
    if (row.onPress) {
      row.onPress();
      return;
    }
    if (row.opensView && row.key === 'language') {
      setView('language');
    }
    if (row.opensView && row.key === 'about') {
      setView('about');
    }
  };

  const goBackToRoot = () => {
    setView('root');
    // Best-effort: return focus to the Language row after the view swaps.
    requestAnimationFrame(() => focusSheetHost(languageRowRef));
  };

  const sheetTitle =
    view === 'language' ? t('menuLanguage') : view === 'about' ? t('menuAbout') : t('menuTitle');

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
          <View
            ref={languageBackRef}
            testID="app-menu-language-focus"
            {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as Record<string, unknown>) : {})}
          >
            <Pressable
              onPress={goBackToRoot}
              accessibilityRole="button"
              accessibilityLabel={t('back')}
              testID="app-menu-back"
              style={({ pressed }) => [styles.backRow, pressed ? styles.rowPressed : null]}
            >
              <Text style={[styles.backLabel, textStyle('row')]}>{t('back')}</Text>
            </Pressable>
          </View>
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
      {view === 'about' ? <AppMenuAboutView onBack={() => setView('root')} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  /** Content-height list — do not stretch the short sheet. */
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
  aboutScroll: {
    // Cancel Sheet body horizontal gutter so About owns 24 px padding.
    marginHorizontal: -layout.screenGutter,
    maxHeight: '100%',
  },
  aboutContent: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  aboutLogo: {
    width: ABOUT_LOGO_WIDTH,
    height: ABOUT_LOGO_HEIGHT,
  },
  aboutCopy: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  aboutPromise: {
    color: color.ink,
    textAlign: 'center',
  },
  aboutVersion: {
    color: color.mutedOnPaper,
    textAlign: 'center',
  },
  aboutBack: {
    alignSelf: 'stretch',
    minHeight: layout.recommendedTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  aboutBackLabel: {
    color: color.ink,
  },
});
