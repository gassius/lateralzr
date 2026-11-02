/**
 * Build-time baked card backgrounds (WebP @3× of 358×560 design units).
 * No react-native-svg on the deck path — Image only.
 *
 * Front bakes already hide motifs intersecting the SVG default `#title-clear-area`
 * (same as PatternLayer pulseXml). Soft glow sprites carry Gaussian blur.
 */
import type { ImageSourcePropType } from 'react-native';
import type { PatternVariantIndex } from '@/lib/patternPlacement';
import {
  PATTERN_BAKE_PIXEL,
  PATTERN_BAKE_SCALE,
} from '@/theme/pattern';

export { PATTERN_BAKE_PIXEL, PATTERN_BAKE_SCALE };

const FRONT: Record<PatternVariantIndex, ImageSourcePropType> = {
  0: require('../assets/images/pattern/baked/pattern-01-3x.webp'),
  1: require('../assets/images/pattern/baked/pattern-02-3x.webp'),
  2: require('../assets/images/pattern/baked/pattern-03-3x.webp'),
};

const EMBOSS: Record<PatternVariantIndex, ImageSourcePropType> = {
  0: require('../assets/images/pattern/baked/emboss-01-3x.webp'),
  1: require('../assets/images/pattern/baked/emboss-02-3x.webp'),
  2: require('../assets/images/pattern/baked/emboss-03-3x.webp'),
};

export const PAPER_FADE_VERTICAL = require('../assets/images/pattern/baked/paper-fade-vertical.webp');

/** Soft connector stroke (baked Gaussian blur) — stretch/rotate at runtime. */
export const GLOW_LINE_SOFT = require('../assets/images/pattern/baked/glow-line-soft.webp');

/** Soft terminal node disc with blur halo. */
export const GLOW_NODE_SOFT = require('../assets/images/pattern/baked/glow-node-soft.webp');

export function bakedPatternFront(variant: PatternVariantIndex): ImageSourcePropType {
  return FRONT[variant];
}

export function bakedPatternEmboss(variant: PatternVariantIndex): ImageSourcePropType {
  return EMBOSS[variant];
}
