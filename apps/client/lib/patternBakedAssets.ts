/**
 * Build-time baked card backgrounds (PNG @3× of 358×560 design units).
 * No react-native-svg on the deck path — Image only.
 */
import type { ImageSourcePropType } from 'react-native';
import type { PatternVariantIndex } from '@/lib/patternPlacement';

export const PATTERN_BAKE_SCALE = 3 as const;
export const PATTERN_BAKE_PIXEL = {
  width: 358 * PATTERN_BAKE_SCALE,
  height: 560 * PATTERN_BAKE_SCALE,
} as const;

const FRONT: Record<PatternVariantIndex, ImageSourcePropType> = {
  0: require('../assets/images/pattern/baked/pattern-01-3x.png'),
  1: require('../assets/images/pattern/baked/pattern-02-3x.png'),
  2: require('../assets/images/pattern/baked/pattern-03-3x.png'),
};

const EMBOSS: Record<PatternVariantIndex, ImageSourcePropType> = {
  0: require('../assets/images/pattern/baked/emboss-01-3x.png'),
  1: require('../assets/images/pattern/baked/emboss-02-3x.png'),
  2: require('../assets/images/pattern/baked/emboss-03-3x.png'),
};

export const PAPER_FADE_VERTICAL = require('../assets/images/pattern/baked/paper-fade-vertical.png');

export function bakedPatternFront(variant: PatternVariantIndex): ImageSourcePropType {
  return FRONT[variant];
}

export function bakedPatternEmboss(variant: PatternVariantIndex): ImageSourcePropType {
  return EMBOSS[variant];
}
