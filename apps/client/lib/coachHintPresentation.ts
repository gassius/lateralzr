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
 *
 * When the equal lower card gap is under the comfortable 2-line chip (~56 pt),
 * use {@link resolveCoachHintFit} compact chrome (smaller type, wider chip) so
 * copy wraps instead of truncating — never `numberOfLines` (Lz-67 B1).
 */

/** Quiet type: v3.3 label (14 / 500). */
export const COACH_HINT_FONT_SIZE = typeSize('label');

export const COACH_HINT_LINE_HEIGHT = textStyle('label').lineHeight as number;

export const COACH_HINT_FONT_WEIGHT = typeWeight('label');

/**
 * Compact tip type when the lower gap cannot hold the 2-line label chip.
 * Sized so 2 wrapped lines + pad fit `bottomSurplus` (~38.9 on 390×844), not
 * the larger *visible* gap (surplus + glyph inset).
 */
export const COACH_HINT_COMPACT_FONT_SIZE = 12;

export const COACH_HINT_COMPACT_LINE_HEIGHT = 17;

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

/** Compact chip: less pad → taller type budget + wider measure for long ES tips. */
export const COACH_HINT_COMPACT_PADDING_V = 2;
export const COACH_HINT_COMPACT_PADDING_H = 6;

/**
 * Minimum clear space between card bottom edge and tip chip (AD Lz-48).
 * Tip sits in the shell gap above the Laterality label — never on the card.
 */
export const COACH_HINT_CARD_CLEARANCE_PX = 8;

/** Tip dismiss control must meet the recommended touch target. */
export const COACH_HINT_MIN_TOUCH_TARGET = 48;

/** Soft max lines the chip is *designed* for (layout math only — never truncates). */
export const COACH_HINT_MAX_LINES = 2;

export type CoachHintFit = 'comfortable' | 'compact';

export type CoachHintChrome = {
  fit: CoachHintFit;
  fontSize: number;
  lineHeight: number;
  fontWeight: NonNullable<ReturnType<typeof typeWeight>>;
  paddingV: number;
  paddingH: number;
};

export function coachHintChrome(fit: CoachHintFit = 'comfortable'): CoachHintChrome {
  if (fit === 'compact') {
    return {
      fit,
      fontSize: COACH_HINT_COMPACT_FONT_SIZE,
      lineHeight: COACH_HINT_COMPACT_LINE_HEIGHT,
      fontWeight: COACH_HINT_FONT_WEIGHT,
      paddingV: COACH_HINT_COMPACT_PADDING_V,
      paddingH: COACH_HINT_COMPACT_PADDING_H,
    };
  }
  return {
    fit: 'comfortable',
    fontSize: COACH_HINT_FONT_SIZE,
    lineHeight: COACH_HINT_LINE_HEIGHT,
    fontWeight: COACH_HINT_FONT_WEIGHT,
    paddingV: COACH_HINT_PADDING_V,
    paddingH: COACH_HINT_PADDING_H,
  };
}

/** In-flow tip band height (padding + lines) for a fit — layout reservation only. */
export function coachHintSlotHeight(
  lineCount: number = COACH_HINT_MAX_LINES,
  fit: CoachHintFit = 'comfortable',
): number {
  const chrome = coachHintChrome(fit);
  const lines = Math.max(1, Math.min(COACH_HINT_MAX_LINES, Math.floor(lineCount)));
  return chrome.paddingV * 2 + chrome.lineHeight * lines;
}

/**
 * Pick tip chrome for the equal lower card gap.
 * Comfortable (label 14 / pad 8×12) when 2 lines fit; otherwise compact
 * (12 / pad 2×6) so a wrapped tip stays inside bottomSurplus (~38.9) without ellipsis.
 */
export function resolveCoachHintFit(gapHeight: number): CoachHintFit {
  const gap = Number.isFinite(gapHeight) ? Math.max(0, gapHeight) : 0;
  return gap >= coachHintSlotHeight(2, 'comfortable') ? 'comfortable' : 'compact';
}

/** @deprecated Prefer {@link resolveCoachHintFit} — tips no longer clamp via numberOfLines. */
export function coachHintLinesForGap(gapHeight: number): 1 | 2 {
  return resolveCoachHintFit(gapHeight) === 'comfortable' ? 2 : 1;
}

/** Expand the chip's hit area to {@link COACH_HINT_MIN_TOUCH_TARGET}. */
export function coachHintHitSlop(fit: CoachHintFit = 'comfortable'): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const chrome = coachHintChrome(fit);
  const visual = chrome.paddingV * 2 + chrome.lineHeight;
  const extra = Math.max(0, COACH_HINT_MIN_TOUCH_TARGET - visual);
  const v = Math.ceil(extra / 2);
  return { top: v, bottom: v, left: 0, right: 0 };
}

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
