import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { readWebPrefersReducedMotion } from '@/lib/cardSwipe';
import { sheetMotionDurationMs, SHEET_BACKDROP_ALPHA } from '@/lib/lateralitySheet';
import { PRACTICE_COLUMN_MAX_WIDTH } from '@/lib/practiceLayout';
import { focusSheetHost } from '@/lib/sheetFocus';
import { t } from '@/lib/i18n';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

export type SheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
  /** Optional helper line under the title (Laterality sheet). */
  helper?: string;
  testID?: string;
  titleTestID?: string;
  closeTestID?: string;
  /** Focus returns here after dismiss animation (e.g. laterality label). */
  returnFocusRef?: RefObject<ViewType | null>;
  /** Called after the close animation finishes. */
  onClosed?: () => void;
};

/**
 * Bottom sheet primitive for the practice column / phone frame.
 * Absolute overlay (not a body portal) so web letterboxing stays uncovered.
 * Reused by Lz-32 app-menu sheets.
 */
export function Sheet({
  visible,
  onDismiss,
  title,
  helper,
  children,
  testID = 'sheet',
  titleTestID = 'sheet-title',
  closeTestID = 'sheet-close',
  returnFocusRef,
  onClosed,
}: SheetProps) {
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (Platform.OS === 'web') {
      return readWebPrefersReducedMotion() ?? true;
    }
    return true;
  });
  const titleRef = useRef<ViewType | null>(null);
  const wasVisibleRef = useRef(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const reduceMotionRef = useRef(reduceMotion);
  const returnFocusRefStable = useRef(returnFocusRef);
  const onClosedRef = useRef(onClosed);
  reduceMotionRef.current = reduceMotion;
  returnFocusRefStable.current = returnFocusRef;
  onClosedRef.current = onClosed;

  // Local OS check (Lz-34 hook deferred — Critiquito / Carlos).
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      setMounted(true);
      const duration = sheetMotionDurationMs(reduceMotionRef.current);
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      const focusTimer = setTimeout(() => focusSheetHost(titleRef), Math.max(16, duration));
      return () => clearTimeout(focusTimer);
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
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * SHEET_BACKDROP_ALPHA,
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

  return (
    <View
      style={styles.root}
      testID={testID}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
          testID={`${testID}-backdrop`}
        />
      </Animated.View>

      <Animated.View style={[styles.panel, panelStyle]} testID={`${testID}-panel`}>
        <View style={styles.handle} accessible={false} testID={`${testID}-handle`} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View
              ref={titleRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel={title}
              testID={titleTestID}
              {...webTitleFocusProps}
            >
              <Text style={[styles.title, textStyle('sheetTitle')]} accessible={false}>
                {title}
              </Text>
            </View>
            {helper ? (
              <Text style={[styles.helper, textStyle('body')]} testID={`${testID}-helper`}>
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
          >
            <Text style={styles.closeGlyph} accessible={false}>
              ×
            </Text>
          </Pressable>
        </View>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.shell,
  },
  panel: {
    width: '100%',
    maxWidth: PRACTICE_COLUMN_MAX_WIDTH,
    backgroundColor: color.paper,
    borderTopLeftRadius: layout.sheetTopRadius,
    borderTopRightRadius: layout.sheetTopRadius,
    paddingBottom: layout.screenGutter,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.divider,
    marginTop: 10,
    marginBottom: 8,
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
  helper: {
    color: color.mutedOnPaper,
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
    fontWeight: '400',
    lineHeight: 32,
    marginTop: -2,
  },
  body: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: 12,
    minHeight: 0,
    flexShrink: 1,
  },
});
