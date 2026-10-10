import { useEffect, useRef } from 'react';
import { Animated as RNAnimated, Image, useWindowDimensions, View } from 'react-native';

/** Master SVG (same geometry as assets/images/lateralzr_logo.svg / path modules). */
const LOGO = require('../assets/images/logo/lateralzr-logo-master.svg');

/** Launch / about lockup: 160–200 px wide (guide §5 / Lz-23). */
const LOCKUP_MIN = 160;
const LOCKUP_MAX = 200;

type LateralzrLogoProps = {
  animate?: boolean;
};

/**
 * Web: SVG as Image. Uses RN Animated (not Reanimated) so opacity loops reliably on react-native-web.
 */
export function LateralzrLogo({ animate = false }: LateralzrLogoProps) {
  const { width: winW } = useWindowDimensions();
  const w = Math.min(Math.max(winW * 0.48, LOCKUP_MIN), LOCKUP_MAX);
  const h = w * (254.62924 / 286.14209);
  const opacity = useRef(new RNAnimated.Value(1)).current;
  const loopRef = useRef<RNAnimated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop?.();
    loopRef.current = null;
    if (!animate) {
      opacity.setValue(1);
      return;
    }
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 0.72,
          duration: 480,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [animate, opacity]);

  return (
    <View accessibilityRole="image" accessibilityLabel="Lateralzr logo">
      <RNAnimated.View style={{ width: w, height: h, opacity }}>
        <Image source={LOGO} style={{ width: w, height: h }} resizeMode="contain" />
      </RNAnimated.View>
    </View>
  );
}
