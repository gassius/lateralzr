import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  COACH_APPEAR_DURATION_MS,
  COACH_APPEAR_TRANSLATE_Y,
  COACH_HINT_FONT_SIZE,
  COACH_HINT_FONT_WEIGHT,
  COACH_HINT_LINE_HEIGHT,
  COACH_HINT_OPACITY,
  coachHintPalette,
  type CoachHintSurface,
} from '@/lib/coachHintPresentation';

type CoachHintProps = {
  text: string;
  /** Fade/slide on appear. False for reduced-motion (text-only, no motion). */
  animateAppear: boolean;
  /** Orange card is the current home; teal is the letterbox if coaching ever sits off-card. */
  surface?: CoachHintSurface;
};

export function CoachHint({ text, animateAppear, surface = 'orange' }: CoachHintProps) {
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
    transform: [{ translateY: (1 - progress.value) * COACH_APPEAR_TRANSLATE_Y }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.anchor, motionStyle]}
      accessibilityLiveRegion="polite"
      testID="coach-hint"
    >
      <View
        style={[
          styles.chip,
          colors.chip === 'transparent' ? styles.chipBare : { backgroundColor: colors.chip },
        ]}
      >
        <Text style={[styles.copy, { color: colors.text }]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Overlay so coaching does not shrink the front well and un-center short labels. */
  anchor: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    alignItems: 'center',
    opacity: COACH_HINT_OPACITY,
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipBare: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  copy: {
    fontSize: COACH_HINT_FONT_SIZE,
    lineHeight: COACH_HINT_LINE_HEIGHT,
    fontWeight: COACH_HINT_FONT_WEIGHT,
    textAlign: 'center',
  },
});
