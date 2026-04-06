import { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  LOGO_SVG_DARK,
  LOGO_SVG_WHITE_DOT_PATHS,
  LOGO_SVG_WHITE_REST,
} from '@/assets/images/lateralzrLogoLayers';

/** Opacity on the parent View often does not affect SvgXml on native; animate SvgXml directly. */
const AnimatedSvgXml = Animated.createAnimatedComponent(SvgXml);

const VB_W = 286.14209;
const VB_H = 254.62924;

function wrapDotPath(fragment: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}"><g transform="translate(-5758.4912,-272.80185)">${fragment}</g></svg>`;
}

type LateralzrLogoProps = {
  animate?: boolean;
};

/** Four white circle paths (path188–190 + path202) pulse in sequence over the static white rest layer. */
export function LateralzrLogo({ animate = false }: LateralzrLogoProps) {
  const { width: winW } = useWindowDimensions();
  const w = Math.min(winW * 0.72, 260);
  const h = w * (VB_H / VB_W);

  const o0 = useSharedValue(1);
  const o1 = useSharedValue(1);
  const o2 = useSharedValue(1);
  const o3 = useSharedValue(1);

  const dots = LOGO_SVG_WHITE_DOT_PATHS.map((fragment) => wrapDotPath(fragment));

  useEffect(() => {
    const opacities = [o0, o1, o2, o3];
    if (!animate) {
      opacities.forEach((s) => {
        cancelAnimation(s);
        s.value = 1;
      });
      return;
    }
    const pulse = withRepeat(
      withSequence(
        withTiming(0.28, { duration: 380 }),
        withTiming(1, { duration: 380 }),
      ),
      -1,
      false,
    );
    opacities.forEach((s, i) => {
      s.value = withDelay(i * 160, pulse);
    });
    return () => {
      opacities.forEach((s) => {
        cancelAnimation(s);
        s.value = 1;
      });
    };
  }, [animate, o0, o1, o2, o3]);

  const s0 = useAnimatedStyle(() => ({ opacity: o0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: o1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: o2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: o3.value }));
  const dotStyles = [s0, s1, s2, s3];

  const dotWrap = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: w,
    height: h,
  };

  return (
    <View style={{ width: w, height: h }} accessibilityRole="image" accessibilityLabel="Lateralzr logo">
      <SvgXml xml={LOGO_SVG_DARK} width={w} height={h} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} pointerEvents="none">
        <SvgXml xml={LOGO_SVG_WHITE_REST} width={w} height={h} />
      </View>
      {dots.map((xml, i) => (
        <View
          key={i}
          style={dotWrap}
          pointerEvents="none"
          {...(Platform.OS === 'android' ? { needsOffscreenAlphaCompositing: true } : {})}
        >
          <AnimatedSvgXml xml={xml} width={w} height={h} style={dotStyles[i]!} />
        </View>
      ))}
    </View>
  );
}
