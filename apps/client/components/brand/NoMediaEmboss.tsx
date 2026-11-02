import { Image, Platform, StyleSheet, View } from 'react-native';
import { bakedPatternEmboss, PAPER_FADE_VERTICAL } from '@/lib/patternBakedAssets';
import type { PatternVariantIndex } from '@/lib/patternPlacement';

type NoMediaEmbossProps = {
  /** Pattern variant for the baked Paper emboss PNG. */
  variant: PatternVariantIndex;
  width: number;
  /** Clipped emboss band (≤ 55% of the card). */
  height: number;
  /** Full face height — pattern is drawn at card scale from the top (§9.4). */
  faceHeight: number;
  fadeStart: number;
};

/**
 * Mirrored Paper blind emboss for no-media and missing-description backs.
 * Build-time PNG — no react-native-svg. Decorative only.
 */
export function NoMediaEmboss({
  variant,
  width,
  height,
  faceHeight,
  fadeStart,
}: NoMediaEmbossProps) {
  if (width < 8 || height < 8 || faceHeight < 8) return null;
  const fadeHeight = Math.max(0, height - fadeStart);

  return (
    <View
      pointerEvents="none"
      testID="card-back-emboss"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
      style={[styles.layer, { width, height, transform: [{ scaleX: -1 }] }]}
    >
      <Image
        source={bakedPatternEmboss(variant)}
        style={{ width, height: faceHeight }}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {fadeHeight > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.fade, { top: fadeStart, height: fadeHeight, width }]}
        >
          <Image
            source={PAPER_FADE_VERTICAL}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  fade: {
    position: 'absolute',
    left: 0,
  },
});
