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
  hideMotifsInPatternSvg,
  motifsIntersectingClearArea,
  patternSvgForVariant,
  resolvePatternClearArea,
  variantFor,
  type PatternRect,
  type PatternVariantIndex,
} from '@/lib/patternPlacement';
import { readJourneyTestParams } from '@/lib/testQueryParams';
import type { SharedValue } from 'react-native-reanimated';
import { RasterizedSvgXml } from './RasterizedSvgXml';

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
  /**
   * Deck-settled capture gate from ConceptCardStack (`!pulseDragging`).
   * When true, idle / underlay cards may toDataURL; when false, never.
   */
  patternCaptureEnabled?: boolean;
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
 * Base XML is memoized on **visual** inputs (variant + hidden motifs + size);
 * glow is a small overlay animated on the UI thread.
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
  patternCaptureEnabled = false,
}: PatternLayerProps) {
  const reduceMotion = useReducedMotion();
  const forcePeak = resolveE2ePulsePeak(readJourneyTestParams().e2ePulsePeak);
  const ready = faceWidth >= 8 && faceHeight >= 8;

  // Visual inputs only — conceptKey is folded into variant; title into clear/motifs.
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
    // titleFaceRect primitives — not concept identity.
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

  const built = useMemo(
    () =>
      ready
        ? {
            variant,
            xml: hideMotifsInPatternSvg(patternSvgForVariant(variant), hiddenMotifs),
            hiddenMotifs,
          }
        : null,
    // Cache / memo on pattern pixels only (variant + which motifs are hidden).
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
      {/*
        Visual-keyed raster cache + deck-settled captureEnabled. Underlay cards
        pre-capture while idle so a swipe never mounts a cold SvgAst+toDataURL.
      */}
      <RasterizedSvgXml
        xml={built.xml}
        width={faceWidth}
        height={faceHeight}
        preserveAspectRatio="xMidYMid slice"
        captureEnabled={patternCaptureEnabled}
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
