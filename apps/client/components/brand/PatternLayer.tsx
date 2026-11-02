import { useMemo } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useConnectorPulse } from '@/hooks/useConnectorPulse';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  CONNECTOR_GLOW_HALO_OPACITIES,
  CONNECTOR_GLOW_LINE_EXTRAS,
  CONNECTOR_GLOW_NODE_RING_EXTRAS,
  CONNECTOR_GLOW_NODE_RING_STROKE,
  connectorPulseAllowed,
  type ConnectorGlowLine,
} from '@/lib/connectorPulse';
import { resolveE2ePulsePeak } from '@/lib/e2eFlags';
import { bakedPatternFront } from '@/lib/patternBakedAssets';
import {
  hideMotifsInPatternSvg,
  motifsIntersectingClearArea,
  patternSvgForVariant,
  resolvePatternClearArea,
  variantFor,
  type PatternRect,
  type PatternVariantIndex,
} from '@/lib/patternPlacement';
import { readJourneyTestParams } from '@/lib/testQueryParams';
import { PATTERN_CARD_FILL, PATTERN_CARD_UNITS, PATTERN_PULSE_GLOW_FILL } from '@/theme/pattern';
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
  /** @deprecated Runtime capture removed — build-time PNGs only. Ignored. */
  patternCaptureEnabled?: boolean;
};

/**
 * Soft glow without react-native-svg: stacked Views (line + terminal node).
 * Geometry is in pattern card units, scaled to the face.
 */
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
  const sx = width / PATTERN_CARD_UNITS.width;
  const sy = height / PATTERN_CARD_UNITS.height;
  const x1 = geometry.x1 * sx;
  const y1 = geometry.y1 * sy;
  const x2 = geometry.x2 * sx;
  const y2 = geometry.y2 * sy;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const endX = geometry.endX * sx;
  const endY = geometry.endY * sy;
  const endR = Math.min(4, geometry.endR) * ((sx + sy) / 2);
  const strokeScale = (sx + sy) / 2;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {CONNECTOR_GLOW_LINE_EXTRAS.map((extra, i) => {
        const opacityHalo = CONNECTOR_GLOW_HALO_OPACITIES[i]!;
        const thickness = (geometry.strokeWidth + extra) * strokeScale;
        return (
          <View
            key={`line-halo-${extra}`}
            style={{
              position: 'absolute',
              left: midX - length / 2,
              top: midY - thickness / 2,
              width: length,
              height: thickness,
              borderRadius: thickness,
              backgroundColor: PATTERN_PULSE_GLOW_FILL,
              opacity: opacityHalo,
              transform: [{ rotate: `${angleDeg}deg` }],
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: midX - length / 2,
          top: midY - (geometry.strokeWidth * strokeScale) / 2,
          width: length,
          height: geometry.strokeWidth * strokeScale,
          borderRadius: geometry.strokeWidth * strokeScale,
          backgroundColor: PATTERN_PULSE_GLOW_FILL,
          transform: [{ rotate: `${angleDeg}deg` }],
        }}
      />
      {CONNECTOR_GLOW_NODE_RING_EXTRAS.map((extra, i) => {
        const opacityHalo = CONNECTOR_GLOW_HALO_OPACITIES[i]!;
        const r = endR + extra * strokeScale;
        const stroke = CONNECTOR_GLOW_NODE_RING_STROKE * strokeScale;
        return (
          <View
            key={`ring-halo-${extra}`}
            style={{
              position: 'absolute',
              left: endX - r,
              top: endY - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              borderWidth: stroke,
              borderColor: PATTERN_PULSE_GLOW_FILL,
              opacity: opacityHalo,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: endX - endR,
          top: endY - endR,
          width: endR * 2,
          height: endR * 2,
          borderRadius: endR,
          backgroundColor: PATTERN_PULSE_GLOW_FILL,
        }}
      />
    </Animated.View>
  );
}

/**
 * Card-front pattern (Lz-25) + connector glow (Lz-58 / §11.3).
 * Build-time PNG background — zero react-native-svg in the deck.
 * Title clear = opaque orange cover over the measured title box (motifs stay in the bake).
 * Glow is View layers; opacity breathes on the UI thread via Reanimated.
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

  const variant: PatternVariantIndex =
    variantOverride != null ? variantOverride : variantFor(conceptKey);
  const clearArea = useMemo(
    () =>
      ready
        ? resolvePatternClearArea({
            variant,
            titleFaceRect,
            faceWidth,
            faceHeight,
          })
        : { x: 0, y: 0, width: 1, height: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit visual deps
    [
      ready,
      variant,
      titleFaceRect?.x,
      titleFaceRect?.y,
      titleFaceRect?.width,
      titleFaceRect?.height,
      faceWidth,
      faceHeight,
    ],
  );
  const hiddenMotifs = useMemo(
    () => (ready ? motifsIntersectingClearArea(variant, clearArea) : []),
    [ready, variant, clearArea],
  );
  const hiddenMotifsKey = hiddenMotifs.join(',');

  /** SVG string kept only for pulse connector picking — never mounted. */
  const pulseXml = useMemo(
    () =>
      ready
        ? hideMotifsInPatternSvg(patternSvgForVariant(variant), hiddenMotifs)
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hiddenMotifsKey stands in for list
    [ready, variant, hiddenMotifsKey],
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
    xml: pulseXml,
    variant,
    clearArea,
    conceptKey,
    forcePeak,
  });

  /** Face-pixel clear cover (pattern image is edge-to-edge on the face). */
  const clearCover = useMemo(() => {
    if (!ready || clearArea.width < 1 || clearArea.height < 1) return null;
    return {
      left: clearArea.x,
      top: clearArea.y,
      width: clearArea.width,
      height: clearArea.height,
    };
  }, [ready, clearArea]);

  if (!ready) {
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
      nativeID={exposeTestId ? `pattern-variant-${variant}` : undefined}
    >
      {exposeTestId ? (
        <View
          testID={pulse.armed ? 'card-front-pulse-armed' : 'card-front-pulse-idle'}
          collapsable={false}
        />
      ) : null}
      <Image
        source={bakedPatternFront(variant)}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {clearCover ? (
        <View
          pointerEvents="none"
          style={[styles.titleClear, clearCover, { backgroundColor: PATTERN_CARD_FILL }]}
          testID={exposeTestId ? 'card-front-pattern-clear' : undefined}
        />
      ) : null}
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
  titleClear: {
    position: 'absolute',
  },
});
