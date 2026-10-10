import { motion } from '../theme/tokens';
import {
  clampLaterality,
  LATERALITY_LABEL_KEYS,
  lateralityA11yText,
  MAX_LATERALITY,
  MIN_LATERALITY,
  type LateralityGrade,
} from './laterality';
import type { MessageKey } from './i18n';

/** Decorative handle only — drag-to-dismiss is out of scope (Critiquito). */
export const LATERALITY_SHEET_ROW_MIN_HEIGHT = 52;

/** Dimmed shell behind the paper panel (~60%). */
export const SHEET_BACKDROP_ALPHA = 0.6;

export type LateralitySheetRow = {
  grade: LateralityGrade;
  labelKey: MessageKey;
  checked: boolean;
  a11yLabel: string;
};

/** Five rows in grade order 1→5 with checked flag + a11y “n of 5” copy. */
export function lateralitySheetRows(selected: number): LateralitySheetRow[] {
  const current = clampLaterality(selected);
  const rows: LateralitySheetRow[] = [];
  for (let n = MIN_LATERALITY; n <= MAX_LATERALITY; n += 1) {
    const grade = n as LateralityGrade;
    rows.push({
      grade,
      labelKey: LATERALITY_LABEL_KEYS[grade],
      checked: grade === current,
      a11yLabel: lateralityA11yText(grade),
    });
  }
  return rows;
}

/** Tap a row → that grade (caller commits via onSelectLaterality, then closes). */
export function lateralitySheetCommitValue(grade: number): LateralityGrade {
  return clampLaterality(grade);
}

/**
 * Open/close duration. Full motion uses `motion.sheetMs` (280).
 * Reduced motion: no slide — fade at `reducedMotionCrossfadeMs`, or 0 for instant.
 */
export function sheetMotionDurationMs(reduceMotion: boolean, preferInstant = false): number {
  if (!reduceMotion) return motion.sheetMs;
  if (preferInstant) return 0;
  return motion.reducedMotionCrossfadeMs;
}
