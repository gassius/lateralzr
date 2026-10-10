import { contrastRatio } from '../theme/contrast';
import { color } from '../theme/tokens';
import { textStyle, typeSize, typeWeight } from '../theme/typography';
import { CONCEPT_FRONT_TITLE_FONT_SIZE } from './conceptFrontTitle';
import { t } from './i18n';

/**
 * Ephemeral complexity cue (Critiquito Lz-12).
 *
 * Laterality has a persistent − / wordmark / + row. Complexity is a different
 * dimension (label density, not edge distance) and must not join that row.
 * Deep links and vertical swipes only get a short, secondary confirmation.
 *
 * Type roles: v3.3 label / meta (Lz-22). Apply `textStyle` at render.
 */

/** Quiet type: v3.3 compact control label. */
export const COMPLEXITY_CUE_FONT_SIZE = typeSize('label');

/** After the chip leaves, a session deep-link keeps this quieter mark (attribution/help). */
export const COMPLEXITY_SESSION_MARK_FONT_SIZE = typeSize('meta');

export const COMPLEXITY_CUE_LINE_HEIGHT = textStyle('label').lineHeight as number;

export const COMPLEXITY_CUE_FONT_WEIGHT = typeWeight('label');

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

export function shouldAnnounceComplexity(event: ComplexityAnnounceEvent): boolean {
  if (event.reason === 'session-url') return true;
  if (event.reason === 'hydrate-stored') return false;
  return event.previous !== event.next;
}

/**
 * Flush a session `?complexity=` cue once the main deck is up.
 *
 * Pending grade is React state (not a ref) so a hydrate that finishes
 * after the first deck paint still re-fires this decision.
 */
export function resolveSessionComplexityToAnnounce(input: {
  alreadyAnnounced: boolean;
  pending: number | null | undefined;
  routeComplexity?: number;
  rememberedComplexity?: number;
}): number | undefined {
  if (input.alreadyAnnounced) return undefined;
  const grade = input.pending ?? input.routeComplexity ?? input.rememberedComplexity;
  if (grade == null) return undefined;
  if (!shouldAnnounceComplexity({ reason: 'session-url', complexity: grade })) {
    return undefined;
  }
  return grade;
}

/** Runtime copy from the active i18n catalog. */
export function complexityCueText(grade: number): string {
  return t('complexityGrade', { grade: String(grade) });
}

/** Deep-link sessions keep a tiny mark after the chip; stored-pref hydrate does not. */
export function shouldKeepSessionComplexityMark(
  reason: ComplexityAnnounceEvent['reason'],
): boolean {
  return reason === 'session-url';
}

export function complexityCueIsSecondaryToConceptTitle(
  cueSize: number = COMPLEXITY_CUE_FONT_SIZE,
  titleSize: number = CONCEPT_FRONT_TITLE_FONT_SIZE,
): boolean {
  return cueSize < titleSize;
}

export function complexityCueHoldMs(reason: ComplexityAnnounceEvent['reason']): number {
  return reason === 'session-url' ? COMPLEXITY_CUE_SESSION_DURATION_MS : COMPLEXITY_CUE_DURATION_MS;
}

export function complexityCuePalette(): ComplexityCuePalette {
  return {
    text: color.concept,
    chip: color.paper,
    backdrop: color.shell,
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
