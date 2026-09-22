import { Palette } from '../constants/Colors';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign';
import { contrastRatio } from './coachHintPresentation';
import { t, type AppLocale } from './i18n';

/**
 * Ephemeral complexity cue (Critiquito Lz-12).
 *
 * Laterality has a persistent − / wordmark / + row. Complexity is a different
 * dimension (label density, not edge distance) and must not join that row.
 * Deep links and vertical swipes only get a short, secondary confirmation.
 */

/** Quiet type: smaller than swipe/flip coaching (17) and the 48px title. */
export const COMPLEXITY_CUE_FONT_SIZE = 14;

export const COMPLEXITY_CUE_LINE_HEIGHT = 18;

export const COMPLEXITY_CUE_FONT_WEIGHT = '500' as const;

/** How long a swipe cue stays readable before it leaves. */
export const COMPLEXITY_CUE_DURATION_MS = 1800;

/** Deep-link cue stays up longer so it is still there after the intro logo. */
export const COMPLEXITY_CUE_SESSION_DURATION_MS = 4000;

/** Brief fade/slide; skipped under reduced motion. */
export const COMPLEXITY_CUE_APPEAR_DURATION_MS = 240;

export const COMPLEXITY_CUE_APPEAR_TRANSLATE_Y = 6;

/** Overlay on the teal letterbox — never the laterality control row. */
export const COMPLEXITY_CUE_PLACEMENT = 'letterbox-overlay' as const;

export type ComplexityAnnounceEvent =
  | { reason: 'session-url'; complexity: number }
  | { reason: 'swipe'; previous: number; next: number }
  | { reason: 'hydrate-stored'; complexity: number };

export type ComplexityCuePalette = {
  text: string;
  chip: string;
  backdrop: string;
};

const CUE_LABEL: Record<AppLocale, string> = {
  en: 'Complexity {grade}',
  es: 'Complejidad {grade}',
};

export function shouldAnnounceComplexity(event: ComplexityAnnounceEvent): boolean {
  if (event.reason === 'session-url') return true;
  if (event.reason === 'hydrate-stored') return false;
  return event.previous !== event.next;
}

export function complexityCueLabel(grade: number, locale: AppLocale = 'en'): string {
  return CUE_LABEL[locale].replaceAll('{grade}', String(grade));
}

/** Runtime copy — same wording as `complexityCueLabel`, via the active catalog. */
export function complexityCueText(grade: number): string {
  return t('complexityGrade', { grade: String(grade) });
}

export function complexityCueSharesLateralityRow(): boolean {
  return false;
}

export function complexityCueIsSecondaryToConceptTitle(
  cueSize: number = COMPLEXITY_CUE_FONT_SIZE,
  titleSize: number = CONCEPT_FRONT_LABEL_FONT_SIZE,
): boolean {
  return cueSize < titleSize;
}

export function complexityCueHoldMs(reason: ComplexityAnnounceEvent['reason']): number {
  return reason === 'session-url' ? COMPLEXITY_CUE_SESSION_DURATION_MS : COMPLEXITY_CUE_DURATION_MS;
}

export function complexityCuePalette(): ComplexityCuePalette {
  return {
    text: Palette.darkBlue,
    chip: Palette.offWhite,
    backdrop: Palette.darkBlue,
  };
}

export function complexityCueContrastRatio(): number {
  const { text, chip, backdrop } = complexityCuePalette();
  const background = chip === 'transparent' ? backdrop : chip;
  return contrastRatio(text, background);
}

export function shouldAnimateComplexityCue(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

export function complexityCueAppearOpacity(reduceMotion: boolean, progress: number): number {
  return reduceMotion ? 1 : progress;
}

export function complexityCueAppearTranslateY(reduceMotion: boolean, progress: number): number {
  return reduceMotion ? 0 : (1 - progress) * COMPLEXITY_CUE_APPEAR_TRANSLATE_Y;
}
