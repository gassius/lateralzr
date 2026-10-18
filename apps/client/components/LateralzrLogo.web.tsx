import { useEffect, useRef } from 'react';
import { Animated as RNAnimated, Image, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { introLogoPulseAllowed, INTRO_LOGO_PULSE_MAX_MS } from '@/lib/introLogo';

/** Master SVG (same geometry as assets/images/lateralzr_logo.svg / path modules). */
const LOGO = require('../assets/images/logo/lateralzr-logo-master.svg');

/** Launch / about lockup: 160–200 px wide (guide §5 / Lz-23). */
const LOCKUP_MIN = 160;
const LOCKUP_MAX = 200;

type LateralzrLogoProps = {
  animate?: boolean;
};

/**
 * Web: SVG as Image. One §5.2 pulse cycle (≤ `INTRO_LOGO_PULSE_MAX_MS`), then still.
 */
export function LateralzrLogo({ animate = false }: LateralzrLogoProps) {
  const reduceMotion = useReducedMotion();
  const runPulse = animate && introLogoPulseAllowed(reduceMotion);
  const { width: winW } = useWindowDimensions();
  const w = Math.min(Math.max(winW * 0.48, LOCKUP_MIN), LOCKUP_MAX);
  const h = w * (254.62924 / 286.14209);
  const opacity = useRef(new RNAnimated.Value(1)).current;
  const pulseRef = useRef<RNAnimated.CompositeAnimation | null>(null);

  useEffect(() => {
    pulseRef.current?.stop?.();
    pulseRef.current = null;
    if (!runPulse) {
      opacity.setValue(1);
      return;
    }
    const half = INTRO_LOGO_PULSE_MAX_MS / 2;
    const once = RNAnimated.sequence([
      RNAnimated.timing(opacity, {
        toValue: 0.72,
        duration: half,
        useNativeDriver: true,
      }),
      RNAnimated.timing(opacity, {
        toValue: 1,
        duration: half,
        useNativeDriver: true,
      }),
    ]);
    pulseRef.current = once;
    once.start();
    return () => {
      once.stop();
      opacity.setValue(1);
    };
  }, [runPulse, opacity]);

  return (
    <View accessibilityRole="image" accessibilityLabel="Lateralzr logo">
      <RNAnimated.View style={{ width: w, height: h, opacity }}>
        <Image source={LOGO} style={{ width: w, height: h }} resizeMode="contain" />
      </RNAnimated.View>
    </View>
  );
}
