import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useConnectorPulse } from '@/hooks/useConnectorPulse';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  buildConnectorGlowOverlayXml,
  connectorPulseAllowed,
  type ConnectorGlowLine,
} from '@/lib/connectorPulse';
import { resolveE2ePulsePeak } from '@/lib/e2eFlags';
import {
  buildPatternSvgXml,
  resolvePatternClearArea,
  type PatternRect,
  type PatternVariantIndex,
} from '@/lib/patternPlacement';
import { readJourneyTestParams } from '@/lib/testQueryParams';
import type { SharedValue } from 'react-native-reanimated';

type PatternLayerProps = {
  /** Concept key for stable variant assignment (`hash % 3`). */
  conceptKey: string;
  faceWidth: number;
  faceHeight: number;
  /**
   * Measured title box in face pixels (origin = top-left of the orange face).
   * Null until onLayout; clearing then uses the SVG default `#title-clear-area`.
   */
  titleFaceRect: PatternRect | null;
  /** Face padding — pattern is edge-to-edge under the padded content. */
  facePad: number;
  /**
   * Only the interactive front-of-stack card should expose `card-front-pattern`
   * (behind / return-overlay duplicates must not — Playwright strict mode).
   */
  exposeTestId?: boolean;
  /** Test-only variant override (0–2). */
  variantOverride?: PatternVariantIndex | null;
  /**
   * Stack-level pulse gate (settled, not flipped/dragging/sheet/background).
   * PatternLayer still applies RM + front-scroll locally.
   */
  pulseGateActive?: boolean;
  /** Front-face ScrollView is scrolling — stops pulse within a frame. */
  frontScrolling?: boolean;
};

function ConnectorGlowOverlay({
  geometry,
  opacity,
  width,
  height,
}: {
  geometry: ConnectorGlowLine;
  opacity: SharedValue<number>;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const xml = useMemo(() => buildConnectorGlowOverlayXml(geometry), [geometry]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <SvgXml xml={xml} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
    </Animated.View>
  );
}

/**
 * Card-front pattern master (Lz-25) + required connector glow (Lz-58 / §11.3).
 * Decorative only — no pointer events, excluded from the accessibility tree.
 * Base XML is memoized; glow is a small overlay animated on the UI thread.
 */
export function PatternLayer({
  conceptKey,
  faceWidth,
  faceHeight,
  titleFaceRect,
  facePad,
  exposeTestId = false,
  variantOverride = null,
  pulseGateActive = false,
  frontScrolling = false,
}: PatternLayerProps) {
  const reduceMotion = useReducedMotion();
  const forcePeak = resolveE2ePulsePeak(readJourneyTestParams().e2ePulsePeak);
  const ready = faceWidth >= 8 && faceHeight >= 8;
  const titleKey = titleFaceRect
    ? `${titleFaceRect.x},${titleFaceRect.y},${titleFaceRect.width},${titleFaceRect.height}`
    : 'none';

  const built = useMemo(
    () =>
      ready
        ? buildPatternSvgXml({
            conceptKey,
            titleFaceRect,
            faceWidth,
            faceHeight,
            variantOverride,
          })
        : null,
    // titleFaceRect is keyed via titleKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- titleKey stands in for titleFaceRect
    [ready, conceptKey, titleKey, faceWidth, faceHeight, variantOverride],
  );

  const clearArea = useMemo(
    () =>
      ready && built != null
        ? resolvePatternClearArea({
            variant: built.variant,
            titleFaceRect,
            faceWidth,
            faceHeight,
          })
        : { x: 0, y: 0, width: 1, height: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- titleKey stands in for titleFaceRect
    [ready, built, titleKey, faceWidth, faceHeight],
  );

  const allowed =
    ready &&
    (forcePeak ||
      connectorPulseAllowed({
        settled: pulseGateActive,
        frontShowing: true,
        dragging: false,
        scrolling: frontScrolling,
        sheetOpen: false,
        appActive: true,
        reduceMotion,
      }));

  const pulse = useConnectorPulse({
    allowed: Boolean(allowed),
    xml: built?.xml ?? '',
    variant: built?.variant ?? 0,
    clearArea,
    conceptKey,
    forcePeak,
  });

  if (!ready || built == null) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          top: -facePad,
          left: -facePad,
          width: faceWidth,
          height: faceHeight,
        },
      ]}
      testID={exposeTestId ? 'card-front-pattern' : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
      nativeID={exposeTestId ? `pattern-variant-${built.variant}` : undefined}
    >
      {exposeTestId ? (
        <View
          testID={pulse.armed ? 'card-front-pulse-armed' : 'card-front-pulse-idle'}
          collapsable={false}
        />
      ) : null}
      <SvgXml
        xml={built.xml}
        width={faceWidth}
        height={faceHeight}
        preserveAspectRatio="xMidYMid slice"
      />
      {pulse.armed && pulse.geometry ? (
        <ConnectorGlowOverlay
          geometry={pulse.geometry}
          opacity={pulse.opacity}
          width={faceWidth}
          height={faceHeight}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 0,
    overflow: 'hidden',
  },
});
