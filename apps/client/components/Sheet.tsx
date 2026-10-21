import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  InteractionManager,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ensureA11yFocusRingStyles } from '@/lib/cardActions';
import { readWebPrefersReducedMotion } from '@/lib/cardSwipe';
import { measureConceptFrontTitleWidth } from '@/lib/conceptFrontTitle';
import { sheetMotionDurationMs } from '@/lib/lateralitySheet';
import { PRACTICE_COLUMN_MAX_WIDTH } from '@/lib/practiceLayout';
import { resolveSheetHardwareBack } from '@/lib/sheetBack';
import { focusSheetHost } from '@/lib/sheetFocus';
import { trapSheetTabKey } from '@/lib/sheetFocusTrap';
import {
  initialSheetTitleMeasureState,
  layoutSheetTitle,
  reduceSheetTitleMeasure,
  sheetTitleHostOpacity,
  sheetTitleLayoutWidth,
  SHEET_TITLE_FONT_SIZE,
  SHEET_TITLE_MEASURE_FALLBACK_MS,
} from '@/lib/sheetTitle';
import { t } from '@/lib/i18n';
import { color, layout, shadow } from '@/theme/tokens';
import { namedFaceStyle, textStyle } from '@/theme/typography';

export type SheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
  /** Optional helper line under the title (Laterality sheet). */
  helper?: string;
  /** Decorative content under the helper (Laterality mini rail). Hidden from AT by the child. */
  afterHelper?: ReactNode;
  /** Parent-owned title host (F7 nested-view re-focus). */
  titleHostRef?: RefObject<ViewType | null>;
  /**
   * When set, Android hardware back prefers this over dismiss, and a header
   * back control is shown (in-sheet nested views). Escape still dismisses.
   */
  onBack?: () => void;
  /** a11y label for the back control (defaults to title of the parent view). */
  backAccessibilityLabel?: string;
  backTestID?: string;
  /** Optional ref on the header back control (focus host for nested views). */
  backRef?: RefObject<ViewType | null>;
  testID?: string;
  titleTestID?: string;
  closeTestID?: string;
  /** Focus returns here after dismiss animation (e.g. laterality label). */
  returnFocusRef?: RefObject<ViewType | null>;
  /** Called after the close animation finishes. */
  onClosed?: () => void;
  /**
   * When set, drives sheet appear/dismiss motion (Lz-46 `useReducedMotion(appPref)`).
   * Omit to keep local OS-only detection (Laterality sheet until it opts in).
   */
  reduceMotion?: boolean;
};

/**
 * Floating Paper sheet (guide §12): inset, all-corner radius, card shadow,
 * plain handle strip, scrim. Overlay stays inside the phone frame.
 */
export function Sheet({
  visible,
  onDismiss,
  title,
  helper,
  afterHelper,
  titleHostRef,
  children,
  onBack,
  backAccessibilityLabel,
  backTestID,
  backRef,
  testID = 'sheet',
  titleTestID = 'sheet-title',
  closeTestID = 'sheet-close',
  returnFocusRef,
  onClosed,
  reduceMotion: reduceMotionProp,
}: SheetProps) {
  const [mounted, setMounted] = useState(visible);
  const [titleMeasure, setTitleMeasure] = useState(initialSheetTitleMeasureState);
  const [localReduceMotion, setLocalReduceMotion] = useState(() => {
    if (Platform.OS === 'web') {
      return readWebPrefersReducedMotion() ?? true;
    }
    return true;
  });
  const reduceMotion = reduceMotionProp ?? localReduceMotion;
  const insets = useSafeAreaInsets();
  const internalTitleRef = useRef<ViewType | null>(null);
  const titleRef = titleHostRef ?? internalTitleRef;
  const panelRef = useRef<ViewType | null>(null);
  const titleBaseStyle = textStyle('sheetTitle');
  /** e2eTextScale multiplies display size only; measure uses size × scale (#82). */
  const e2eScale = Math.max(
    1,
    ((titleBaseStyle.fontSize as number) ?? SHEET_TITLE_FONT_SIZE) / SHEET_TITLE_FONT_SIZE,
  );
  const measureFontScale = PixelRatio.getFontScale() * e2eScale;
  const titleLayoutWidth = sheetTitleLayoutWidth(titleMeasure);
  const titleLayout = layoutSheetTitle(
    title,
    titleLayoutWidth,
    measureConceptFrontTitleWidth,
    measureFontScale,
  );
  const titleFontSize = Math.round(titleLayout.fontSize * e2eScale);
  const titleLineHeight = Math.round(titleLayout.lineHeight * e2eScale);
  const titleHostOpacity = sheetTitleHostOpacity(titleMeasure);
  const wasVisibleRef = useRef(visible);
  const focusedTitleThisOpenRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const progress = useSharedValue(visible ? 1 : 0);
  const reduceMotionRef = useRef(reduceMotion);
  const returnFocusRefStable = useRef(returnFocusRef);
  const onClosedRef = useRef(onClosed);
  const onBackRef = useRef(onBack);
  reduceMotionRef.current = reduceMotion;
  returnFocusRefStable.current = returnFocusRef;
  onClosedRef.current = onClosed;
  onBackRef.current = onBack;

  useLayoutEffect(() => {
    if (Platform.OS === 'web') ensureA11yFocusRingStyles();
  }, []);

  // Local OS check when uncontrolled. Prefer `reduceMotion` prop from
  // `useReducedMotion(appPref)` (Lz-46) so in-app Reduced applies immediately.
  useEffect(() => {
    if (reduceMotionProp != null) return;
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setLocalReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setLocalReduceMotion(enabled);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [reduceMotionProp]);

  // B2: reveal after positive onLayout or ~100ms fallback; freeze width on first paint (AD/#84).
  useEffect(() => {
    if (!mounted) {
      setTitleMeasure(initialSheetTitleMeasureState());
      return;
    }
    if (titleMeasure.frozenWidth !== null) return;
    const timer = setTimeout(() => {
      setTitleMeasure((prev) => reduceSheetTitleMeasure(prev, { type: 'timeout' }));
    }, SHEET_TITLE_MEASURE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [mounted, titleMeasure.frozenWidth]);

  const focusOpenTitle = () => {
    if (focusedTitleThisOpenRef.current || !visibleRef.current) return;
    focusedTitleThisOpenRef.current = true;
    focusSheetHost(titleRef);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.querySelector<HTMLElement>(`[data-testid="${titleTestID}"]`)?.focus?.({
        preventScroll: true,
      });
    }
  };

  // F7 web: focus immediately so Playwright's fake clock never has a leftover
  // timer to steal the Motion row. Native waits until the open animation
  // commits — setAccessibilityFocus before that is often a no-op (PRR B2).
  useLayoutEffect(() => {
    if (!visible) {
      focusedTitleThisOpenRef.current = false;
      return;
    }
    if (!mounted || Platform.OS !== 'web') return;
    focusOpenTitle();
  }, [visible, mounted, titleTestID]);

  // Open/close animation — deps are visibility only (PRR B1: unstable onBack must
  // not restart the sheet). Nested Back focus lives in AppMenuSheet via `view`.
  useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      setMounted(true);
      const duration = sheetMotionDurationMs(reduceMotionRef.current);
      const focusNativeTitle = () => {
        if (Platform.OS === 'web') return;
        focusOpenTitle();
      };
      if (duration <= 0) {
        progress.value = 1;
        const handle = InteractionManager.runAfterInteractions(focusNativeTitle);
        return () => handle.cancel();
      }
      progress.value = withTiming(
        1,
        { duration, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(focusNativeTitle)();
        },
      );
      return;
    }

    // Skip the initial mount when the sheet starts closed.
    if (!wasVisibleRef.current) return;

    const finishClose = () => {
      wasVisibleRef.current = false;
      setMounted(false);
      focusSheetHost(returnFocusRefStable.current);
      onClosedRef.current?.();
    };

    const duration = sheetMotionDurationMs(reduceMotionRef.current);
    if (duration <= 0) {
      progress.value = 0;
      finishClose();
      return;
    }

    progress.value = withTiming(
      0,
      { duration, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [visible, progress]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (resolveSheetHardwareBack(onBackRef.current != null) === 'nestedBack') {
        onBackRef.current?.();
        return true;
      }
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Nested views: Escape dismisses the whole sheet (close), not back.
        onDismiss();
        return;
      }
      // Lz-41: keep Tab inside the panel (backdrop is not a Tab stop).
      if (event.key === 'Tab') {
        const panelNode =
          (document.querySelector(`[data-testid="${testID}-panel"]`) as HTMLElement | null) ??
          (panelRef.current as unknown as HTMLElement | null);
        if (panelNode) trapSheetTabKey(panelNode, event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss, testID]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const panelStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: progress.value,
        transform: [{ translateY: 0 }],
      };
    }
    return {
      opacity: 1,
      transform: [{ translateY: (1 - progress.value) * 48 }],
    };
  });

  if (!mounted) return null;

  const webTitleFocusProps =
    Platform.OS === 'web' ? ({ tabIndex: 0 } as Record<string, unknown>) : {};
  /** Close / back are Tab stops; backdrop is click-only (Lz-41). */
  const webControlFocusProps =
    Platform.OS === 'web' ? ({ tabIndex: 0 } as Record<string, unknown>) : {};
  const webBackdropFocusProps =
    Platform.OS === 'web'
      ? ({ tabIndex: -1, 'aria-hidden': true } as Record<string, unknown>)
      : {};

  return (
    <View
      style={styles.root}
      testID={testID}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      pointerEvents="box-none"
      // Web dialog semantics for axe / AT (native uses accessibilityViewIsModal).
      {...(Platform.OS === 'web'
        ? ({ role: 'dialog', 'aria-modal': true } as Record<string, unknown>)
        : null)}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
          testID={`${testID}-backdrop`}
          {...webBackdropFocusProps}
        />
      </Animated.View>

      <Animated.View
        ref={panelRef}
        style={[
          styles.panel,
          {
            marginHorizontal: layout.sheetInset,
            marginBottom: layout.sheetBottomGap + insets.bottom,
          },
          panelStyle,
        ]}
        testID={`${testID}-panel`}
      >
        <View style={styles.panelClip}>
        <View style={styles.handleStrip} accessible={false} testID={`${testID}-handle-strip`}>
          <View style={styles.handle} accessible={false} testID={`${testID}-handle`} />
        </View>
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              ref={backRef}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={backAccessibilityLabel ?? t('menuTitle')}
              testID={backTestID ?? `${testID}-back`}
              style={({ pressed }) => [styles.backBtn, pressed ? styles.closePressed : null]}
              hitSlop={4}
              {...webControlFocusProps}
            >
              <Text style={styles.backGlyph} accessible={false}>
                ‹
              </Text>
            </Pressable>
          ) : null}
          <View
            style={styles.headerText}
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.width);
              setTitleMeasure((prev) =>
                reduceSheetTitleMeasure(prev, { type: 'layout', width: next }),
              );
            }}
          >
            <View
              ref={titleRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel={title}
              testID={titleTestID}
              // m1: hide until measured; B2: ~100ms fallback; AD: freeze width on first visible frame.
              style={titleHostOpacity === 1 ? undefined : styles.titlePending}
              {...webTitleFocusProps}
            >
              <Text
                style={[
                  styles.title,
                  titleBaseStyle,
                  {
                    fontSize: titleFontSize,
                    lineHeight: titleLineHeight,
                    ...(Platform.OS === 'web'
                      ? { fontWeight: titleBaseStyle.fontWeight }
                      : null),
                  },
                  styles.titleWrap,
                ]}
                accessible={false}
              >
                {titleLayout.displayText}
              </Text>
            </View>
            {helper ? (
              <Text style={[styles.helper, textStyle('meta')]} testID={`${testID}-helper`}>
                {helper}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            testID={closeTestID}
            style={({ pressed }) => [styles.closeBtn, pressed ? styles.closePressed : null]}
            hitSlop={4}
            {...webControlFocusProps}
          >
            <Text style={styles.closeGlyph} accessible={false}>
              ×
            </Text>
          </Pressable>
        </View>
        {afterHelper}
        <View style={styles.body}>{children}</View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    elevation: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.scrim,
  },
  panel: {
    alignSelf: 'stretch',
    maxWidth: PRACTICE_COLUMN_MAX_WIDTH,
    backgroundColor: color.paper,
    borderRadius: layout.sheetRadius,
    maxHeight: '92%',
    shadowColor: shadow.card.color,
    shadowOffset: {
      width: shadow.card.offsetWidth,
      height: shadow.card.offsetHeight,
    },
    shadowOpacity: shadow.card.opacity,
    shadowRadius: shadow.card.radius,
    elevation: shadow.card.elevation,
    paddingBottom: 12,
  },
  panelClip: {
    borderRadius: layout.sheetRadius,
    overflow: 'hidden',
    minHeight: 0,
    flexShrink: 1,
  },
  handleStrip: {
    height: layout.sheetHandleStrip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.paper,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: layout.screenGutter,
    gap: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    color: color.ink,
  },
  titlePending: {
    opacity: 0,
  },
  /** Honour layout `\n` / `-\n`; never let the engine bare-split a word (Lz-31 ES). */
  titleWrap: {
    // RN Web Text defaults to wordWrap:'break-word' — override like ConceptCard.
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'pre-wrap',
          wordBreak: 'normal',
          wordWrap: 'normal',
          overflowWrap: 'normal',
        } as object)
      : {}),
  },
  helper: {
    color: color.mutedOnPaper,
  },
  backBtn: {
    width: layout.recommendedTouchTarget,
    height: layout.recommendedTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginLeft: -8,
  },
  backGlyph: {
    color: color.ink,
    fontSize: 32,
    ...namedFaceStyle('400'),
    lineHeight: 36,
    marginTop: -4,
  },
  closeBtn: {
    width: layout.recommendedTouchTarget,
    height: layout.recommendedTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  closePressed: {
    opacity: 0.65,
  },
  closeGlyph: {
    color: color.ink,
    fontSize: 28,
    ...namedFaceStyle('400'),
    lineHeight: 32,
    marginTop: -2,
  },
  body: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: 12,
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
  },
});
