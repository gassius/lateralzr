import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useConnectorPulse } from '@/hooks/useConnectorPulse';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { connectorPulseAllowed } from '@/lib/connectorPulse';
import { resolveE2ePulsePeak } from '@/lib/e2eFlags';
import {
  buildPatternSvgXml,
  resolvePatternClearArea,
  type PatternRect,
  type PatternVariantIndex,
} from '@/lib/patternPlacement';
import { readJourneyTestParams } from '@/lib/testQueryParams';

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
 * Card-front pattern master (Lz-25) + optional connector breath (Lz-40).
 * Decorative only — no pointer events, excluded from the accessibility tree.
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
  // M1: `?e2ePulsePeak=1` is ignored outside test/dev builds (not production web).
  const forcePeak = resolveE2ePulsePeak(readJourneyTestParams().e2ePulsePeak);
  const ready = faceWidth >= 8 && faceHeight >= 8;

  const built = ready
    ? buildPatternSvgXml({
        conceptKey,
        titleFaceRect,
        faceWidth,
        faceHeight,
        variantOverride,
      })
    : null;

  const clearArea = ready
    ? resolvePatternClearArea({
        variant: built!.variant,
        titleFaceRect,
        faceWidth,
        faceHeight,
      })
    : null;

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
    clearArea: clearArea ?? { x: 0, y: 0, width: 1, height: 1 },
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
      // Expose variant for Critiquito / Playwright without affecting a11y tree.
      nativeID={exposeTestId ? `pattern-variant-${built.variant}` : undefined}
    >
      <SvgXml
        xml={pulse.pulsedXml || built.xml}
        width={faceWidth}
        height={faceHeight}
        preserveAspectRatio="xMidYMid slice"
      />
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
