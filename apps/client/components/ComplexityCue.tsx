import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  COMPLEXITY_CUE_APPEAR_DURATION_MS,
  COMPLEXITY_CUE_APPEAR_TRANSLATE_Y,
  COMPLEXITY_CUE_DURATION_MS,
  complexityCuePalette,
  complexityCueText,
  shouldAnimateComplexityCue,
} from '@/lib/complexityFeedback';
import { textStyle } from '@/theme/typography';

type ComplexityCueProps = {
  grade: number;
  /** Changes when the same grade is re-announced so the timer restarts. */
  token: number;
  /** How long the chip stays up before fading. */
  holdMs?: number;
  onHidden: () => void;
};

export function ComplexityCue({
  grade,
  token,
  holdMs = COMPLEXITY_CUE_DURATION_MS,
  onHidden,
}: ComplexityCueProps) {
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(reduceMotion);
  const onHiddenRef = useRef(onHidden);
  /** Visible on the first frame so a failed appear animation cannot hide the cue. */
  const progress = useSharedValue(1);
  const colors = complexityCuePalette();
  const label = complexityCueText(grade);

  onHiddenRef.current = onHidden;
  reduceMotionRef.current = reduceMotion;

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
        <Text style={[styles.copy, textStyle('label'), { color: colors.text }]}>{label}</Text>
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
      <Text style={[styles.sessionMark, textStyle('meta'), { color: colors.chip }]}>{label}</Text>
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
    textAlign: 'center',
  },
  sessionMark: {
    textAlign: 'center',
    opacity: 0.82,
  },
});
