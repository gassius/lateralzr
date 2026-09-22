import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
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
  complexityCuePalette,
  complexityCueText,
  shouldAnimateComplexityCue,
} from '@/lib/complexityFeedback';

type ComplexityCueProps = {
  grade: number;
  /** Changes when the same grade is re-announced so the timer restarts. */
  token: number;
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

export function ComplexityCue({ grade, token, onHidden }: ComplexityCueProps) {
  const reduceMotionRef = useRef(initialReduceMotion());
  const onHiddenRef = useRef(onHidden);
  const animate = shouldAnimateComplexityCue(reduceMotionRef.current);
  const progress = useSharedValue(animate ? 0 : 1);
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
      const timer = setTimeout(hide, COMPLEXITY_CUE_DURATION_MS);
      return () => clearTimeout(timer);
    }

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: COMPLEXITY_CUE_APPEAR_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });

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
    }, COMPLEXITY_CUE_DURATION_MS);

    return () => clearTimeout(timer);
  }, [grade, token, progress]);

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
      <Text style={[styles.copy, { color: colors.text }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Top of the teal letterbox — away from the laterality − / wordmark / + row. */
  anchor: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 4,
  },
  copy: {
    fontSize: COMPLEXITY_CUE_FONT_SIZE,
    lineHeight: COMPLEXITY_CUE_LINE_HEIGHT,
    fontWeight: COMPLEXITY_CUE_FONT_WEIGHT,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
