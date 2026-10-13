import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from 'react-native';
import Constants from 'expo-constants';
import Svg, { Polyline, SvgXml } from 'react-native-svg';
import { LOGO_SVG_ON_PAPER } from '@/assets/images/logo/lateralzrLogoOnPaper';
import { Sheet } from '@/components/Sheet';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { aboutViewContent } from '@/lib/aboutView';
import {
  ABOUT_LOGO_WIDTH,
  APP_MENU_ROW_CLUSTER_JUSTIFY_CONTENT,
  APP_MENU_ROW_LABEL_FLEX_SHRINK,
  APP_MENU_ROW_LABEL_MIN_WIDTH_WEB,
  APP_MENU_ROW_MIN_HEIGHT,
  APP_MENU_ROW_VALUE_FLEX_GROW,
  APP_MENU_ROW_VALUE_FLEX_SHRINK,
  APP_MENU_VALUE_FONT_SIZE,
  APP_MENU_VALUE_LINE_HEIGHT,
  appMenuRowA11yLabel,
  appMenuRowShowsChevron,
  DEFAULT_APP_MENU_FEATURES,
  focusLanguagePickerOnOpen,
  isAppMenuNestedView,
  visibleAppMenuRows,
  withAppMenuRowPress,
  type AppMenuFeatures,
  type AppMenuRowDef,
  type AppMenuView,
} from '@/lib/appMenu';
import { readAppVersion } from '@/lib/appVersion';
import { complexityCueText } from '@/lib/complexityFeedback';
import {
  COMPLEXITY_MENU_ROW_MIN_HEIGHT,
  complexityMenuCommitValue,
  complexityMenuRows,
} from '@/lib/complexityMenu';
import {
  localeDisplayKey,
  SUPPORTED_LOCALES,
  t,
  type AppLocale,
} from '@/lib/i18n';
import { LATERALITY_SHEET_ROW_MIN_HEIGHT } from '@/lib/lateralitySheet';
import {
  DEFAULT_MOTION_PREFERENCE,
  MOTION_PREFERENCE_OPTIONS,
  motionPreferenceLabelKey,
  type MotionPreference,
} from '@/lib/motionStorage';
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
  /** Current complexity grade (1–5); drives the Complexity row value + picker. */
  currentComplexity: number;
  /** Persist + apply grade for the next move; must not advance the deck. */
  onSelectComplexity: (grade: number) => void;
  /** In-app Motion preference (Lz-46). */
  motionPreference?: MotionPreference;
  onMotionPreferenceChange?: (pref: MotionPreference) => void;
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

function MenuRadio({ checked }: { checked: boolean }) {
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
    <View>
      {showDivider ? <View style={styles.divider} testID={`app-menu-divider-${row.key}`} /> : null}
      <Pressable
        ref={rowRef}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        testID={`app-menu-row-${row.key}`}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
        {...webFocusProps}
      >
        <View style={styles.rowTextCluster} testID={`app-menu-row-text-${row.key}`}>
          <Text
            style={[styles.rowLabel, textStyle('row')]}
            testID={`app-menu-row-label-${row.key}`}
          >
            {t(row.labelKey)}
          </Text>
          {valueText ? (
            <Text
              style={styles.rowValue}
              testID={`app-menu-row-value-${row.key}`}
            >
              {valueText}
            </Text>
          ) : null}
        </View>
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
  const content = aboutViewContent(t, readAppVersion(Constants.expoConfig?.version));
  const textA11y = `${content.promise}, ${content.version}`;

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
        accessibilityLabel={content.logoLabel}
        testID="app-menu-about-logo"
        style={[styles.aboutLogo, { opacity: content.logoOpacity }]}
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
          {content.promise}
        </Text>
        <Text style={[styles.aboutVersion, textStyle('meta')]} accessible={false}>
          {content.version}
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
 * General app menu sheet (guide §12.2). Language (Lz-44), Complexity (Lz-45),
 * Motion (Lz-46), About (Lz-47), and Replay tips share one sheet with in-sheet views.
 */
export function AppMenuSheet({
  visible,
  onDismiss,
  onReplayGestureTips,
  locale,
  onSelectLocale,
  currentComplexity,
  onSelectComplexity,
  motionPreference = DEFAULT_MOTION_PREFERENCE,
  onMotionPreferenceChange,
  returnFocusRef,
  features = DEFAULT_APP_MENU_FEATURES,
}: AppMenuSheetProps) {
  const [view, setView] = useState<AppMenuView>('root');
  const languageRowRef = useRef<ViewType | null>(null);
  const complexityRowRef = useRef<ViewType | null>(null);
  const motionRowRef = useRef<ViewType | null>(null);
  const sheetBackRef = useRef<ViewType | null>(null);
  const reduceMotion = useReducedMotion(motionPreference);
  const complexityValue = complexityCueText(currentComplexity);
  const pickerRows = useMemo(
    () => complexityMenuRows(currentComplexity),
    [currentComplexity],
  );
  const nestedBack = isAppMenuNestedView(view) && view !== 'about';

  const rows = useMemo(
    () =>
      withAppMenuRowPress(visibleAppMenuRows(features), {
        language: () => setView('language'),
        complexity: () => setView('complexity'),
        motion: () => setView('motion'),
        about: () => setView('about'),
        replayTips: () => {
          onReplayGestureTips();
          onDismiss();
        },
      }).map((row) => {
        if (row.key === 'language') {
          return {
            ...row,
            valueKey: localeDisplayKey(locale),
          };
        }
        if (row.key === 'complexity') {
          return {
            ...row,
            value: complexityValue,
          };
        }
        if (row.key === 'motion') {
          return {
            ...row,
            valueKey: motionPreferenceLabelKey(motionPreference),
          };
        }
        return row;
      }),
    [complexityValue, features, locale, motionPreference, onDismiss, onReplayGestureTips],
  );

  useEffect(() => {
    if (!visible) setView('root');
  }, [visible]);

  const viewRef = useRef(view);
  viewRef.current = view;

  // Single focus-Back path (PRR B1): only when `view` enters a nested picker.
  // Retries cover the back control mounting after the title swap — never wired
  // through Sheet's open effect (unstable onBack must not restart animation).
  useEffect(() => {
    if (view !== 'language' && view !== 'complexity' && view !== 'motion') return;
    let cancelled = false;
    const focusBack = () => {
      if (cancelled) return;
      focusLanguagePickerOnOpen(focusSheetHost, sheetBackRef);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.querySelector<HTMLElement>('[data-testid="app-menu-back"]')?.focus?.();
      }
    };
    const frame = requestAnimationFrame(focusBack);
    const timers = [0, 48, 120].map((ms) => setTimeout(focusBack, ms));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      for (const id of timers) clearTimeout(id);
    };
  }, [view]);

  const onRowPress = (row: AppMenuRowDef) => {
    if (row.onPress) {
      row.onPress();
      return;
    }
    if (row.opensView && row.key === 'language') {
      setView('language');
    }
    if (row.opensView && row.key === 'complexity') {
      setView('complexity');
    }
    if (row.opensView && row.key === 'motion') {
      setView('motion');
    }
    if (row.opensView && row.key === 'about') {
      setView('about');
    }
  };

  /** Stable so Sheet open/close effects never restart on parent re-renders (PRR B1). */
  const goBackToRoot = useCallback(() => {
    const current = viewRef.current;
    const returnRef =
      current === 'complexity'
        ? complexityRowRef
        : current === 'motion'
          ? motionRowRef
          : languageRowRef;
    setView('root');
    requestAnimationFrame(() => focusSheetHost(returnRef));
  }, []);

  /**
   * Focus Motion row after preference-driven re-render (fake-clock safe; no setTimeout).
   * Hold across several rAF frames so a later reduceMotion remount cannot leave focus
   * on the dialog title (first tabbable) when the selected radio unmounts.
   */
  const pendingMotionRowFocusRef = useRef(false);
  const focusMotionMenuRow = useCallback(() => {
    focusSheetHost(motionRowRef);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document
        .querySelector<HTMLElement>('[data-testid="app-menu-row-motion"]')
        ?.focus?.();
    }
  }, []);

  const selectMotion = useCallback(
    (pref: MotionPreference) => {
      setView('root');
      pendingMotionRowFocusRef.current = true;
      onMotionPreferenceChange?.(pref);
    },
    [onMotionPreferenceChange],
  );

  useLayoutEffect(() => {
    if (view !== 'root' || !pendingMotionRowFocusRef.current) return;
    let frames = 0;
    let raf = 0;
    let cancelled = false;
    const holdFrames = 45;
    const tick = () => {
      if (cancelled) return;
      focusMotionMenuRow();
      frames += 1;
      if (frames >= holdFrames) {
        pendingMotionRowFocusRef.current = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    focusMotionMenuRow();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      // Keep pending so a follow-up commit (motionPreference / reduceMotion) restarts hold.
    };
  }, [view, motionPreference, focusMotionMenuRow]);

  const sheetTitle =
    view === 'language'
      ? t('menuLanguage')
      : view === 'complexity'
        ? t('menuComplexity')
        : view === 'motion'
          ? t('menuMotion')
          : view === 'about'
            ? t('menuAbout')
            : t('menuTitle');

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      title={sheetTitle}
      testID="app-menu"
      titleTestID="app-menu-title"
      closeTestID="app-menu-close"
      returnFocusRef={returnFocusRef}
      onBack={nestedBack ? goBackToRoot : undefined}
      backAccessibilityLabel={t('back')}
      backTestID="app-menu-back"
      backRef={sheetBackRef}
      reduceMotion={reduceMotion}
    >
      {view === 'root' ? (
        <View style={styles.list} testID="app-menu-rows">
          {rows.map((row, index) => (
            <AppMenuRow
              key={row.key}
              row={row}
              showDivider={index > 0}
              onPress={() => onRowPress(row)}
              rowRef={
                row.key === 'language'
                  ? languageRowRef
                  : row.key === 'complexity'
                    ? complexityRowRef
                    : row.key === 'motion'
                      ? motionRowRef
                      : undefined
              }
            />
          ))}
        </View>
      ) : null}
      {view === 'language' ? (
        <View style={styles.languageView} testID="app-menu-language">
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
                  <MenuRadio checked={checked} />
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
      {view === 'complexity' ? (
        <ScrollView
          style={styles.pickerList}
          contentContainerStyle={styles.pickerListContent}
          keyboardShouldPersistTaps="handled"
          testID="app-menu-complexity-rows"
        >
          {pickerRows.map((row) => (
            <Pressable
              key={row.grade}
              onPress={() => {
                onSelectComplexity(complexityMenuCommitValue(row.grade));
                setView('root');
                requestAnimationFrame(() => focusSheetHost(complexityRowRef));
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: row.checked }}
              accessibilityLabel={row.a11yLabel}
              testID={`app-menu-complexity-row-${row.grade}`}
              style={({ pressed }) => [
                styles.pickerRow,
                row.checked ? styles.pickerRowSelected : null,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <MenuRadio checked={row.checked} />
              <Text
                style={[
                  styles.pickerRowLabel,
                  textStyle('row'),
                  row.checked ? styles.pickerRowLabelSelected : null,
                ]}
              >
                {row.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {view === 'motion' ? (
        <View style={styles.languageView} testID="app-menu-motion">
          <View style={styles.languageList} testID="app-menu-motion-rows">
            {MOTION_PREFERENCE_OPTIONS.map((pref) => {
              const checked = motionPreference === pref;
              const labelKey = motionPreferenceLabelKey(pref);
              const label = t(labelKey);
              // RN-web radio Pressable does not commit on Space/Enter without a key handler.
              const motionWebKeyProps =
                Platform.OS === 'web'
                  ? ({
                      tabIndex: 0,
                      onKeyDown: (event: {
                        nativeEvent?: { key?: string };
                        preventDefault?: () => void;
                      }) => {
                        const key = event.nativeEvent?.key;
                        if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
                        event.preventDefault?.();
                        selectMotion(pref);
                      },
                    } as Record<string, unknown>)
                  : {};
              return (
                <Pressable
                  key={pref}
                  onPress={() => selectMotion(pref)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  accessibilityLabel={label}
                  testID={`app-menu-motion-row-${pref}`}
                  style={({ pressed }) => [
                    styles.languageRow,
                    checked ? styles.languageRowSelected : null,
                    pressed ? styles.rowPressed : null,
                  ]}
                  {...motionWebKeyProps}
                >
                  <MenuRadio checked={checked} />
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
  /**
   * Label+value wrap as a unit; chevron stays centred on the row.
   * space-between keeps the value flush-right on a shared line (Lz-44) and
   * left-packs it when it wraps under the label (AD Lz-45 / open-200 320).
   */
  rowTextCluster: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: APP_MENU_ROW_CLUSTER_JUSTIFY_CONTENT,
    alignItems: 'center',
    columnGap: 12,
    rowGap: 2,
  },
  rowLabel: {
    flexGrow: 0,
    flexShrink: APP_MENU_ROW_LABEL_FLEX_SHRINK,
    color: color.ink,
    // Web: wrap at spaces, never mid-word; min-content ≥ longest word (PRR B3).
    ...(Platform.OS === 'web'
      ? ({
          wordBreak: 'normal',
          overflowWrap: 'normal',
          hyphens: 'none',
          minWidth: APP_MENU_ROW_LABEL_MIN_WIDTH_WEB,
        } as object)
      : null),
  },
  rowValue: {
    flexGrow: APP_MENU_ROW_VALUE_FLEX_GROW,
    flexShrink: APP_MENU_ROW_VALUE_FLEX_SHRINK,
    minWidth: 0,
    color: color.mutedOnPaper,
    fontSize: APP_MENU_VALUE_FONT_SIZE,
    lineHeight: APP_MENU_VALUE_LINE_HEIGHT,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.divider,
  },
  languageView: {
    paddingBottom: 8,
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
  /** Match LateralitySheet radio list geometry. */
  pickerList: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  pickerListContent: {
    paddingBottom: 8,
    gap: 4,
    flexGrow: 1,
  },
  pickerRow: {
    minHeight: COMPLEXITY_MENU_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pickerRowSelected: {
    backgroundColor: color.selectedSoft,
  },
  pickerRowLabel: {
    flex: 1,
    color: color.ink,
  },
  pickerRowLabelSelected: {
    color: color.ink,
  },
});
