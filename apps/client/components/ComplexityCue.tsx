import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  COMPLEXITY_CUE_APPEAR_DURATION_MS,
  COMPLEXITY_CUE_APPEAR_TRANSLATE_Y,
  COMPLEXITY_CUE_DURATION_MS,
  COMPLEXITY_CUE_FONT_SIZE,
  COMPLEXITY_CUE_FONT_WEIGHT,
  COMPLEXITY_CUE_LINE_HEIGHT,
  COMPLEXITY_SESSION_MARK_FONT_SIZE,
  complexityCuePalette,
  complexityCueText,
  shouldAnimateComplexityCue,
} from '@/lib/complexityFeedback';

type ComplexityCueProps = {
  grade: number;
  /** Changes when the same grade is re-announced so the timer restarts. */
  token: number;
  /** How long the chip stays up before fading. */
  holdMs?: number;
  onHidden: () => void;
};

function initialReduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function ComplexityCue({
  grade,
  token,
  holdMs = COMPLEXITY_CUE_DURATION_MS,
  onHidden,
}: ComplexityCueProps) {
  const reduceMotionRef = useRef(initialReduceMotion());
  const onHiddenRef = useRef(onHidden);
  /** Visible on the first frame so a failed appear animation cannot hide the cue. */
  const progress = useSharedValue(1);
  const colors = complexityCuePalette();
  const label = complexityCueText(grade);

  onHiddenRef.current = onHidden;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) reduceMotionRef.current = enabled;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    const hide = () => {
      onHiddenRef.current();
    };

    if (!shouldAnimateComplexityCue(reduceMotionRef.current)) {
      progress.value = 1;
      const timer = setTimeout(hide, holdMs);
      return () => clearTimeout(timer);
    }

    progress.value = 1;

    const timer = setTimeout(() => {
      progress.value = withTiming(
        0,
        {
          duration: COMPLEXITY_CUE_APPEAR_DURATION_MS,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(hide)();
        },
      );
    }, holdMs);

    return () => clearTimeout(timer);
  }, [grade, holdMs, token, progress]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * COMPLEXITY_CUE_APPEAR_TRANSLATE_Y }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.anchor, motionStyle]}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityLabel={label}
      testID="complexity-cue"
    >
      <View style={[styles.chip, { backgroundColor: colors.chip }]}>
        <Text style={[styles.copy, { color: colors.text }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

/** Tiny leftover after the session chip — still not on the laterality row. */
export function ComplexitySessionMark({ grade }: { grade: number }) {
  const colors = complexityCuePalette();
  const label = complexityCueText(grade);

  return (
    <View
      pointerEvents="none"
      style={styles.anchor}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityLabel={label}
      testID="complexity-session-mark"
    >
      <Text style={[styles.sessionMark, { color: colors.chip }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Filled by the parent slot so this stays out of the laterality row. */
  anchor: {
    alignItems: 'center',
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  copy: {
    fontSize: COMPLEXITY_CUE_FONT_SIZE,
    lineHeight: COMPLEXITY_CUE_LINE_HEIGHT,
    fontWeight: COMPLEXITY_CUE_FONT_WEIGHT,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sessionMark: {
    fontSize: COMPLEXITY_SESSION_MARK_FONT_SIZE,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
    opacity: 0.82,
  },
});
