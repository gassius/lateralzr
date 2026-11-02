import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { color } from '@/theme/tokens';
import { RasterizedSvgXml } from './RasterizedSvgXml';

type NoMediaEmbossProps = {
  xml: string;
  width: number;
  /** Clipped emboss band (≤ 55% of the card). */
  height: number;
  /** Full face height — pattern is drawn at card scale from the top (§9.4). */
  faceHeight: number;
  fadeStart: number;
  /**
   * Deck-settled capture gate — same signal as PatternLayer. Idle cards
   * (including the unflipped back face) pre-rasterise so flip never mounts
   * a cold UseView tree on the gesture frame.
   */
  captureEnabled?: boolean;
};

/**
 * Mirrored Paper blind emboss for no-media and missing-description backs.
 * Decorative only — excluded from the accessibility tree and never glows.
 * Static pattern XML is drawn once to a cached Image (same path as PatternLayer).
 */
export function NoMediaEmboss({
  xml,
  width,
  height,
  faceHeight,
  fadeStart,
  captureEnabled = false,
}: NoMediaEmbossProps) {
  if (width < 8 || height < 8 || faceHeight < 8 || !xml) return null;
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
      {/*
        Full-face raster clipped by the emboss band (matches prior SvgXml layout:
        width × faceHeight with xMidYMin slice inside overflow:hidden).
      */}
      <View style={{ width, height: faceHeight }} collapsable={false}>
        <RasterizedSvgXml
          xml={xml}
          width={width}
          height={faceHeight}
          preserveAspectRatio="xMidYMin slice"
          captureEnabled={captureEnabled}
        />
      </View>
      {fadeHeight > 0 ? (
        <View style={[styles.fade, { top: fadeStart, height: fadeHeight }]} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="noMediaEmbossFade" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={color.paper} stopOpacity="0" />
                <Stop offset="100%" stopColor={color.paper} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#noMediaEmbossFade)" />
          </Svg>
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
    right: 0,
  },
});
