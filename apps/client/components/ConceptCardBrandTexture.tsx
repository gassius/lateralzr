import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { markTextureSvg } from '@/assets/images/lateralzrMark';
import {
  CARD_BRAND_BACK_BOTTOM,
  CARD_BRAND_BACK_RIGHT,
  CARD_BRAND_FRONT_BOTTOM,
  cardBrandSize,
  cardBrandTokens,
  type CardBrandFace,
} from '@/lib/conceptCardBrand';

type ConceptCardBrandTextureProps = {
  face: CardBrandFace;
  faceWidth: number;
};

/**
 * Decorative Lateralzr mark on a concept-card face.
 * Not a control — pointer-events none, hidden from the accessibility tree.
 */
export function ConceptCardBrandTexture({ face, faceWidth }: ConceptCardBrandTextureProps) {
  const tokens = cardBrandTokens(face);
  const { width, height } = cardBrandSize(faceWidth, face);
  if (width < 8 || height < 8) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, face === 'front' ? styles.front : styles.back]}
      testID={`card-${face}-brand`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SvgXml xml={markTextureSvg(tokens.fill, tokens.opacity)} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 0,
  },
  front: {
    left: 0,
    right: 0,
    bottom: CARD_BRAND_FRONT_BOTTOM,
    alignItems: 'center',
  },
  back: {
    right: CARD_BRAND_BACK_RIGHT,
    bottom: CARD_BRAND_BACK_BOTTOM,
  },
});
