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
  coachHintChrome,
  coachHintHitSlop,
  COACH_HINT_FONT_SIZE,
  COACH_HINT_OPACITY,
  COACH_HINT_RADIUS,
  coachHintPalette,
  type CoachHintFit,
  type CoachHintSurface,
} from '@/lib/coachHintPresentation';
import { namedFaceStyle, textStyle } from '@/theme/typography';

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
  /**
   * Comfortable (label) or compact (smaller type, wider chip) so copy fits the
   * lower card gap without truncation — wrap only, never ellipsis (Lz-67 B1).
   */
  fit?: CoachHintFit;
};

export function CoachHint({
  text,
  animateAppear = true,
  surface = 'shell',
  onDismiss,
  fit = 'comfortable',
}: CoachHintProps) {
  const progress = useSharedValue(animateAppear ? 0 : 1);
  const colors = coachHintPalette(surface);
  const chrome = coachHintChrome(fit);
  // Scale compact sizes with the same e2eTextScale factor textStyle applies.
  const labelScaled = textStyle('label');
  const scale = (labelScaled.fontSize as number) / COACH_HINT_FONT_SIZE;
  const copyStyle =
    fit === 'compact'
      ? {
          ...namedFaceStyle(chrome.fontWeight),
          fontSize: Math.round(chrome.fontSize * scale),
          lineHeight: Math.round(chrome.lineHeight * scale),
        }
      : labelScaled;

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
        hitSlop={coachHintHitSlop(fit)}
        style={[
          styles.chip,
          {
            paddingHorizontal: chrome.paddingH,
            paddingVertical: chrome.paddingV,
          },
          colors.chip === 'transparent' ? styles.chipBare : { backgroundColor: colors.chip },
        ]}
      >
        {/* Full copy always — wrap via type/width, never ellipsis. */}
        <Text style={[styles.copy, copyStyle, { color: colors.text }]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Parent slot positions this in the control region above the rail. */
  anchor: {
    alignItems: 'stretch',
    width: '100%',
    opacity: COACH_HINT_OPACITY,
  },
  /** Full-width chip so long ES tips measure against the column, not a shrink-wrap. */
  chip: {
    width: '100%',
    maxWidth: '100%',
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
