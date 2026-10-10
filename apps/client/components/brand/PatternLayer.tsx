import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  buildPatternSvgXml,
  type PatternRect,
  type PatternVariantIndex,
} from '@/lib/patternPlacement';

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
  /** Test-only variant override (0–2). */
  variantOverride?: PatternVariantIndex | null;
};

/**
 * Card-front pattern master (Lz-25). Decorative only — no pointer events,
 * excluded from the accessibility tree. Front face only.
 */
export function PatternLayer({
  conceptKey,
  faceWidth,
  faceHeight,
  titleFaceRect,
  facePad,
  variantOverride = null,
}: PatternLayerProps) {
  if (faceWidth < 8 || faceHeight < 8) {
    return null;
  }

  const { xml, variant } = buildPatternSvgXml({
    conceptKey,
    titleFaceRect,
    faceWidth,
    faceHeight,
    variantOverride,
  });

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
      testID="card-front-pattern"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Expose variant for Critiquito / Playwright without affecting a11y tree.
      nativeID={`pattern-variant-${variant}`}
    >
      <SvgXml
        xml={xml}
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
