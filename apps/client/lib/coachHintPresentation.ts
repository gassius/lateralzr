import { blendHexOver, contrastRatio, relativeLuminance } from '../theme/contrast';
import { color } from '../theme/tokens';
import { textStyle, typeSize, typeWeight } from '../theme/typography';
import { CONCEPT_FRONT_TITLE_FONT_SIZE } from './conceptFrontTitle';

export { blendHexOver, contrastRatio, relativeLuminance } from '../theme/contrast';

/**
 * Visual tokens for §12.3 discovery tips (Lz-48).
 *
 * Tips sit on the shell in the control region above the laterality rail —
 * never over the concept title or card. Chip: shell tinted with rail @ 10%,
 * paper 14/500 text, radius 12, padding 8×12.
 */

/** Quiet type: v3.3 label (14 / 500). */
export const COACH_HINT_FONT_SIZE = typeSize('label');

export const COACH_HINT_LINE_HEIGHT = textStyle('label').lineHeight as number;

export const COACH_HINT_FONT_WEIGHT = typeWeight('label');

/** Full opacity — washed-out overlays failed contrast on the letterbox. */
export const COACH_HINT_OPACITY = 1;

/** Full-motion tip fade (§12.3). Reduced motion uses instant show (animateAppear false). */
export const COACH_APPEAR_DURATION_MS = 150;

/** No slide — tip chip fades in place (peek removed under §12.3). */
export const COACH_APPEAR_TRANSLATE_Y = 0;

/** Chip geometry (§12.3). */
export const COACH_HINT_RADIUS = 12;
export const COACH_HINT_PADDING_V = 8;
export const COACH_HINT_PADDING_H = 12;

/** Rail over shell at 10% for the tip chip fill. */
export const COACH_HINT_CHIP_RAIL_ALPHA = 0.1;

export type CoachHintSurface = 'shell' | 'orange' | 'teal';

export type CoachHintPalette = {
  text: string;
  /** Chip fill. */
  chip: string;
  /** Backdrop color the chip sits on, used for contrast checks. */
  backdrop: string;
};

function shellTintedChip(): string {
  return blendHexOver(color.rail, COACH_HINT_CHIP_RAIL_ALPHA, color.shell);
}

export const COACH_HINT_PALETTE: Record<CoachHintSurface, CoachHintPalette> = {
  shell: {
    text: color.paper,
    chip: shellTintedChip(),
    backdrop: color.shell,
  },
  /** Legacy orange-card surface — kept for contrast helpers / older callers. */
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

export function coachHintPalette(surface: CoachHintSurface = 'shell'): CoachHintPalette {
  return COACH_HINT_PALETTE[surface];
}

export function coachHintIsSecondaryToConceptTitle(
  coachSize: number = COACH_HINT_FONT_SIZE,
  titleSize: number = CONCEPT_FRONT_TITLE_FONT_SIZE,
): boolean {
  return coachSize < titleSize;
}

/** Text contrast against the color the glyphs actually sit on (chip, else backdrop). */
export function coachHintContrastRatio(surface: CoachHintSurface = 'shell'): number {
  const { text, chip, backdrop } = COACH_HINT_PALETTE[surface];
  const background = chip === 'transparent' ? backdrop : chip;
  return contrastRatio(text, background);
}
