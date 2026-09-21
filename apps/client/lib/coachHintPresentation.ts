import { Palette } from '../constants/Colors';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign';

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
    text: Palette.darkBlue,
    chip: Palette.offWhite,
    backdrop: Palette.orange,
  },
  teal: {
    text: Palette.offWhite,
    chip: 'transparent',
    backdrop: Palette.darkBlue,
  },
};

export function coachHintPalette(surface: CoachHintSurface): CoachHintPalette {
  return COACH_HINT_PALETTE[surface];
}

export function shouldAnimateCoachAppear(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

/** Opacity at a 0–1 appear progress. Reduced motion is fully visible immediately. */
export function coachAppearOpacity(reduceMotion: boolean, progress: number): number {
  return reduceMotion ? 1 : progress;
}

/** Upward slide in px. Reduced motion stays put. */
export function coachAppearTranslateY(reduceMotion: boolean, progress: number): number {
  return reduceMotion ? 0 : (1 - progress) * COACH_APPEAR_TRANSLATE_Y;
}

export function coachHintIsSecondaryToConceptTitle(
  coachSize: number = COACH_HINT_FONT_SIZE,
  titleSize: number = CONCEPT_FRONT_LABEL_FONT_SIZE,
): boolean {
  return coachSize < titleSize;
}

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const n = hex.replace('#', '');
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const h = (c: number) => Math.round(c).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function channelLuminance(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two opaque hex colors. */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lighter = Math.max(relativeLuminance(foregroundHex), relativeLuminance(backgroundHex));
  const darker = Math.min(relativeLuminance(foregroundHex), relativeLuminance(backgroundHex));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composite a translucent foreground over an opaque background (for legacy-style checks). */
export function blendHexOver(foregroundHex: string, alpha: number, backgroundHex: string): string {
  const fg = hexToRgb(foregroundHex);
  const bg = hexToRgb(backgroundHex);
  const a = Math.min(1, Math.max(0, alpha));
  return rgbToHex({
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  });
}

/** Text contrast against the color the glyphs actually sit on (chip, else backdrop). */
export function coachHintContrastRatio(surface: CoachHintSurface): number {
  const { text, chip, backdrop } = COACH_HINT_PALETTE[surface];
  const background = chip === 'transparent' ? backdrop : chip;
  return contrastRatio(text, background);
}
