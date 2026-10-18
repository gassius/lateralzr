import { useEffect, useRef } from 'react';
import { Animated as RNAnimated, Image, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LOGO_SVG_WHITE_DOT_PATHS } from '@/assets/images/lateralzrLogoLayers';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  introLogoPulseAllowed,
  INTRO_LOGO_PULSE_NODE_ID,
  INTRO_LOGO_PULSE_PEAK_OPACITY,
  LOGO_PULSE_HALF_MS,
  recolouredIntroPulsePath,
} from '@/lib/introLogo';

/** Master SVG (same geometry as assets/images/lateralzr_logo.svg / path modules). */
const LOGO = require('../assets/images/logo/lateralzr-logo-master.svg');

/** Launch / about lockup: 160–200 px wide (guide §5 / Lz-23). */
const LOCKUP_MIN = 160;
const LOCKUP_MAX = 200;

const VB_W = 286.14209;
const VB_H = 254.62924;

function wrapDotPath(fragment: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}"><g transform="translate(-5758.4912,-272.80185)">${fragment}</g></svg>`;
}

const PULSE_NODE = LOGO_SVG_WHITE_DOT_PATHS.find((fragment) =>
  fragment.includes(`id="${INTRO_LOGO_PULSE_NODE_ID}"`),
);

type LateralzrLogoProps = {
  animate?: boolean;
};

/**
 * Web: static lockup Image. Optional §5.2 pulse overlays one terminal node in #FFC98A.
 */
export function LateralzrLogo({ animate = false }: LateralzrLogoProps) {
  const reduceMotion = useReducedMotion();
  const runPulse = animate && introLogoPulseAllowed(reduceMotion);
  const { width: winW } = useWindowDimensions();
  const w = Math.min(Math.max(winW * 0.48, LOCKUP_MIN), LOCKUP_MAX);
  const h = w * (VB_H / VB_W);
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const pulseRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const pulseXml = PULSE_NODE ? wrapDotPath(recolouredIntroPulsePath(PULSE_NODE)) : null;

  useEffect(() => {
    pulseRef.current?.stop?.();
    pulseRef.current = null;
    if (!runPulse || pulseXml == null) {
      opacity.setValue(0);
      return;
    }
    opacity.setValue(0);
    const once = RNAnimated.sequence([
      RNAnimated.timing(opacity, {
        toValue: INTRO_LOGO_PULSE_PEAK_OPACITY,
        duration: LOGO_PULSE_HALF_MS,
        useNativeDriver: true,
      }),
      RNAnimated.timing(opacity, {
        toValue: 0,
        duration: LOGO_PULSE_HALF_MS,
        useNativeDriver: true,
      }),
    ]);
    pulseRef.current = once;
    once.start();
    return () => {
      once.stop();
      opacity.setValue(0);
    };
  }, [runPulse, pulseXml, opacity]);

  return (
    <View accessibilityRole="image" accessibilityLabel="Lateralzr logo">
      <View style={{ width: w, height: h }}>
        <Image source={LOGO} style={{ width: w, height: h }} resizeMode="contain" />
        {pulseXml ? (
          <RNAnimated.View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, opacity }}
          >
            <SvgXml xml={pulseXml} width={w} height={h} />
          </RNAnimated.View>
        ) : null}
      </View>
    </View>
  );
}
