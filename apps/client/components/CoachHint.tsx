import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  COACH_APPEAR_DURATION_MS,
  coachHintHitSlop,
  COACH_HINT_OPACITY,
  COACH_HINT_PADDING_H,
  COACH_HINT_PADDING_V,
  COACH_HINT_RADIUS,
  coachHintPalette,
  type CoachHintSurface,
} from '@/lib/coachHintPresentation';
import { textStyle } from '@/theme/typography';

type CoachHintProps = {
  text: string;
  /**
   * When true, fade in over {@link COACH_APPEAR_DURATION_MS} (no slide / pulse).
   * False under reduced motion — instant show (opacity 1).
   */
  animateAppear?: boolean;
  /** Shell control-region tip is the §12.3 default. */
  surface?: CoachHintSurface;
  /** Tap dismisses the tip (§12.3). */
  onDismiss?: () => void;
};

export function CoachHint({
  text,
  animateAppear = true,
  surface = 'shell',
  onDismiss,
}: CoachHintProps) {
  const progress = useSharedValue(animateAppear ? 0 : 1);
  const colors = coachHintPalette(surface);

  useEffect(() => {
    if (!animateAppear) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: COACH_APPEAR_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [text, animateAppear, progress]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[styles.anchor, motionStyle]}
      accessibilityLiveRegion="polite"
      testID="coach-hint"
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={text}
        disabled={onDismiss == null}
        hitSlop={coachHintHitSlop()}
        style={[
          styles.chip,
          colors.chip === 'transparent' ? styles.chipBare : { backgroundColor: colors.chip },
        ]}
      >
        <Text style={[styles.copy, textStyle('label'), { color: colors.text }]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Parent slot positions this in the control region above the rail. */
  anchor: {
    alignItems: 'center',
    opacity: COACH_HINT_OPACITY,
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: COACH_HINT_PADDING_H,
    paddingVertical: COACH_HINT_PADDING_V,
    borderRadius: COACH_HINT_RADIUS,
  },
  chipBare: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  copy: {
    textAlign: 'left',
  },
});
