import { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import {
  LOADING_CARD_HAIRLINE_ALPHA,
  LOADING_CARD_PATTERN_OPACITY,
  LOADING_CARD_RAIL_ALPHA,
  LOADING_PATTERN_VARIANT,
} from '@/lib/loadingCard';
import { bakedPatternFront } from '@/lib/patternBakedAssets';
import { CARD_SHADOW, cardRadius, cardShadowStyle } from '@/lib/cardLayout';
import { hexToRgba } from '@/theme/contrast';
import { color } from '@/theme/tokens';

type LoadingCardProps = {
  /** Expose Playwright hook on the interactive silhouette. */
  exposeTestId?: boolean;
};

/**
 * Quiet loading silhouette (Lz-35): front-sized card, no title, no pulse, no spinner.
 * Build-time pattern PNG — no react-native-svg.
 */
export function LoadingCard({ exposeTestId = true }: LoadingCardProps) {
  const [face, setFace] = useState({ width: 0, height: 0 });
  const radius = cardRadius();

  return (
    <View
      style={styles.root}
      testID={exposeTestId ? 'loading-card' : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.face,
          Platform.OS === 'android' ? cardShadowStyle('android') : CARD_SHADOW,
          {
            borderRadius: radius,
            backgroundColor: hexToRgba(color.rail, LOADING_CARD_RAIL_ALPHA),
            borderColor: hexToRgba(color.rail, LOADING_CARD_HAIRLINE_ALPHA),
          },
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (
            width > 0 &&
            height > 0 &&
            (width !== face.width || height !== face.height)
          ) {
            setFace({ width, height });
          }
        }}
      >
        {face.width >= 8 && face.height >= 8 ? (
          <View
            pointerEvents="none"
            style={[styles.pattern, { opacity: LOADING_CARD_PATTERN_OPACITY }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            nativeID="loading-pattern-variant-3"
          >
            <Image
              source={bakedPatternFront(LOADING_PATTERN_VARIANT)}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  face: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pattern: {
    ...StyleSheet.absoluteFill,
  },
});
