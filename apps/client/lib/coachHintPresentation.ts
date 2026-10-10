import { blendHexOver, contrastRatio, relativeLuminance } from '../theme/contrast';
import { color } from '../theme/tokens';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign';

export { blendHexOver, contrastRatio, relativeLuminance } from '../theme/contrast';

/**
 * Visual tokens for momentary swipe/flip coaching (Critiquito Lz-06).
 *
 * The previous overlay was 12px / 75% opacity / bottom-left on orange — easy to
 * miss at arm's length. Coaching stays progressive (not always-on); this module
 * only makes the copy readable when it is shown.
 */

/** Secondary to the 48px concept title; large enough to read at arm's length. */
export const COACH_HINT_FONT_SIZE = 17;

export const COACH_HINT_LINE_HEIGHT = 22;

export const COACH_HINT_FONT_WEIGHT = '600' as const;

/** Full opacity — washed-out 0.75 on orange was the contrast failure. */
export const COACH_HINT_OPACITY = 1;

/** Brief fade/slide when the coach appears. Skipped under reduced motion. */
export const COACH_APPEAR_DURATION_MS = 280;

export const COACH_APPEAR_TRANSLATE_Y = 8;

export type CoachHintSurface = 'orange' | 'teal';

export type CoachHintPalette = {
  text: string;
  /** Chip fill. Transparent on teal so copy sits on the letterbox, not a second card. */
  chip: string;
  /** Card / letterbox color the chip sits on, used for contrast checks. */
  backdrop: string;
};

export const COACH_HINT_PALETTE: Record<CoachHintSurface, CoachHintPalette> = {
  orange: {
    text: color.concept,
    chip: color.paper,
    backdrop: color.front,
  },
  teal: {
    text: color.paper,
    chip: 'transparent',
    backdrop: color.shell,
  },
};

export function coachHintPalette(surface: CoachHintSurface): CoachHintPalette {
  return COACH_HINT_PALETTE[surface];
}

export function coachHintIsSecondaryToConceptTitle(
  coachSize: number = COACH_HINT_FONT_SIZE,
  titleSize: number = CONCEPT_FRONT_LABEL_FONT_SIZE,
): boolean {
  return coachSize < titleSize;
}

/** Text contrast against the color the glyphs actually sit on (chip, else backdrop). */
export function coachHintContrastRatio(surface: CoachHintSurface): number {
  const { text, chip, backdrop } = COACH_HINT_PALETTE[surface];
  const background = chip === 'transparent' ? backdrop : chip;
  return contrastRatio(text, background);
}
