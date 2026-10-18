import { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  LOGO_SVG_DARK,
  LOGO_SVG_WHITE_DOT_PATHS,
  LOGO_SVG_WHITE_REST,
} from '@/assets/images/lateralzrLogoLayers';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  introLogoPulseAllowed,
  INTRO_LOGO_PULSE_NODE_ID,
  INTRO_LOGO_PULSE_PEAK_OPACITY,
  LOGO_PULSE_HALF_MS,
  recolouredIntroPulsePath,
} from '@/lib/introLogo';

/** Opacity on the parent View often does not affect SvgXml on native; animate SvgXml directly. */
const AnimatedSvgXml = Animated.createAnimatedComponent(SvgXml);

const VB_W = 286.14209;
const VB_H = 254.62924;

/** Launch / about lockup: 160–200 px wide (guide §5 / Lz-23). */
const LOCKUP_MIN = 160;
const LOCKUP_MAX = 200;

function wrapDotPath(fragment: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}"><g transform="translate(-5758.4912,-272.80185)">${fragment}</g></svg>`;
}

const PULSE_NODE_INDEX = LOGO_SVG_WHITE_DOT_PATHS.findIndex((fragment) =>
  fragment.includes(`id="${INTRO_LOGO_PULSE_NODE_ID}"`),
);

type LateralzrLogoProps = {
  animate?: boolean;
};

/** Static lockup; optional §5.2 pulse lights one terminal mark node in #FFC98A once. */
export function LateralzrLogo({ animate = false }: LateralzrLogoProps) {
  const reduceMotion = useReducedMotion();
  const runPulse = animate && introLogoPulseAllowed(reduceMotion);
  const { width: winW } = useWindowDimensions();
  const w = Math.min(Math.max(winW * 0.48, LOCKUP_MIN), LOCKUP_MAX);
  const h = w * (VB_H / VB_W);

  const glow = useSharedValue(0);
  const dots = LOGO_SVG_WHITE_DOT_PATHS.map((fragment) => wrapDotPath(fragment));
  const pulseNode = PULSE_NODE_INDEX >= 0 ? LOGO_SVG_WHITE_DOT_PATHS[PULSE_NODE_INDEX]! : null;
  const pulseXml = pulseNode
    ? wrapDotPath(recolouredIntroPulsePath(pulseNode))
    : null;

  useEffect(() => {
    cancelAnimation(glow);
    if (!runPulse || pulseXml == null) {
      glow.value = 0;
      return;
    }
    glow.value = 0;
    glow.value = withSequence(
      withTiming(INTRO_LOGO_PULSE_PEAK_OPACITY, { duration: LOGO_PULSE_HALF_MS }),
      withTiming(0, { duration: LOGO_PULSE_HALF_MS }),
    );
    return () => {
      cancelAnimation(glow);
      glow.value = 0;
    };
  }, [runPulse, pulseXml, glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

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
          <SvgXml xml={xml} width={w} height={h} />
        </View>
      ))}
      {pulseXml ? (
        <AnimatedSvgXml
          xml={pulseXml}
          width={w}
          height={h}
          style={[dotWrap, glowStyle]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}
