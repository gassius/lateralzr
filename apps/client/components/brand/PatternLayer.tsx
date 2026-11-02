import { useMemo } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useConnectorPulse } from '@/hooks/useConnectorPulse';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  connectorPulseAllowed,
  type ConnectorGlowLine,
} from '@/lib/connectorPulse';
import { resolveE2ePulsePeak } from '@/lib/e2eFlags';
import {
  bakedPatternFront,
  GLOW_LINE_SOFT,
  GLOW_NODE_SOFT,
} from '@/lib/patternBakedAssets';
import {
  cardRectToFacePixels,
  defaultTitleClearForVariant,
  hideMotifsInPatternSvg,
  motifBoundingBox,
  motifsIntersectingClearArea,
  patternSvgForVariant,
  resolvePatternClearArea,
  variantFor,
  type PatternRect,
  type PatternVariantIndex,
} from '@/lib/patternPlacement';
import { PATTERN_VARIANT_PLACEMENTS } from '@/lib/patternVariantPlacements';
import { readJourneyTestParams } from '@/lib/testQueryParams';
import { PATTERN_CARD_FILL, PATTERN_CARD_UNITS } from '@/theme/pattern';
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

/**
 * Soft glow without react-native-svg: baked WebP sprites (Gaussian blur at
 * bake time). Geometry is in pattern card units, scaled to the face.
 * Node size follows `geometry.endR` (already capped in connectorPulse).
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
  const strokeScale = (sx + sy) / 2;
  // Match buildConnectorGlowOverlayXml: endR is card units (already ≤ NODE_R_MAX).
  const endR = geometry.endR * strokeScale;
  // Soft line sprite is 256×64 with ~6px core + blur — scale height to stroke halo.
  const lineH = Math.max(12, (geometry.strokeWidth + 6) * strokeScale * 2.2);
  // Soft node sprite is 64×64 with solid r≈5; map that core to endR.
  const nodeSize = Math.max(8, endR * 2 * (64 / 10));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={GLOW_LINE_SOFT}
        style={{
          position: 'absolute',
          left: midX - length / 2,
          top: midY - lineH / 2,
          width: length,
          height: lineH,
          transform: [{ rotate: `${angleDeg}deg` }],
        }}
        resizeMode="stretch"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Image
        source={GLOW_NODE_SOFT}
        style={{
          position: 'absolute',
          left: endX - nodeSize / 2,
          top: endY - nodeSize / 2,
          width: nodeSize,
          height: nodeSize,
        }}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Animated.View>
  );
}

/**
 * Card-front pattern (Lz-25) + connector glow (Lz-58 / §11.3).
 * Build-time WebP background — zero react-native-svg in the deck.
 * Default title-clear motifs are baked out; measured title only covers
 * extra motif AABBs (matches pulseXml hideMotifs, not a solid rect cut).
 * Glow is soft baked sprites; opacity breathes via Reanimated.
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

  /** Motifs already removed in the bake (default `#title-clear-area`). */
  const bakedHidden = useMemo(
    () => motifsIntersectingClearArea(variant, defaultTitleClearForVariant(variant)),
    [variant],
  );

  /**
   * Extra motifs the measured title needs hidden beyond the bake — cover
   * each motif AABB with card fill (same visual as hideMotifsInPatternSvg).
   */
  const motifCovers = useMemo(() => {
    if (!ready) return [] as Array<PatternRect & { id: string }>;
    const baked = new Set(bakedHidden);
    const covers: Array<PatternRect & { id: string }> = [];
    for (const id of hiddenMotifs) {
      if (baked.has(id)) continue;
      const placement = PATTERN_VARIANT_PLACEMENTS[variant].motifs.find((m) => m.id === id);
      if (!placement) continue;
      const face = cardRectToFacePixels(
        motifBoundingBox(placement),
        faceWidth,
        faceHeight,
      );
      covers.push({ id, ...face });
    }
    return covers;
  }, [ready, bakedHidden, hiddenMotifs, variant, faceWidth, faceHeight]);

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
      {motifCovers.map((cover) => (
        <View
          key={cover.id}
          pointerEvents="none"
          style={[
            styles.motifCover,
            {
              left: cover.x,
              top: cover.y,
              width: cover.width,
              height: cover.height,
              backgroundColor: PATTERN_CARD_FILL,
            },
          ]}
          testID={exposeTestId ? `card-front-pattern-clear-${cover.id}` : undefined}
        />
      ))}
      {exposeTestId && motifCovers.length === 0 ? (
        <View testID="card-front-pattern-clear" collapsable={false} />
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
  motifCover: {
    position: 'absolute',
  },
});
