import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { color } from '@/theme/tokens';

type NoMediaEmbossProps = {
  xml: string;
  width: number;
  height: number;
  fadeStart: number;
};

/**
 * Mirrored Paper blind emboss for no-media and missing-description backs.
 * Decorative only — excluded from the accessibility tree and never glows.
 */
export function NoMediaEmboss({ xml, width, height, fadeStart }: NoMediaEmbossProps) {
  if (width < 8 || height < 8 || !xml) return null;
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
      <SvgXml xml={xml} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
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
