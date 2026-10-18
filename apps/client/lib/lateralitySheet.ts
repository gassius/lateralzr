import { color, layout, motion } from '../theme/tokens';
import {
  clampLaterality,
  LATERALITY_LABEL_KEYS,
  lateralityA11yText,
  MAX_LATERALITY,
  MIN_LATERALITY,
  type LateralityGrade,
} from './laterality';
import type { MessageKey } from './i18n';

/** Sheet radio / menu rows — guide §12 / `layout.sheetRowHeight`. */
export const LATERALITY_SHEET_ROW_MIN_HEIGHT = layout.sheetRowHeight;

/** Decorative mini rail under the Laterality helper (§12.1). Hidden from AT. */
export const LATERALITY_MINI_RAIL_DOT_COUNT = 5;
export const LATERALITY_MINI_RAIL_HEIGHT = 28;

/** Selected radio ring + row radius (guide §12.1). */
export const LATERALITY_SHEET_RADIO_SIZE = 24;
export const LATERALITY_SHEET_ROW_RADIUS = 14;

/** Parse `#RRGGBBAA` (or opaque hex) alpha for the sheet scrim. */
export function sheetScrimAlpha(scrimHex: string = color.scrim): number {
  const n = scrimHex.replace('#', '');
  if (n.length === 8) return parseInt(n.slice(6, 8), 16) / 255;
  return 1;
}

/** Dimmed shell behind the floating Paper card (`color.scrim` ≈ 45%). */
export const SHEET_BACKDROP_ALPHA = sheetScrimAlpha();

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

/** Mini-rail selected dot is the 1–5 grade (left = 1). */
export function lateralityMiniRailSelectedDot(grade: number): LateralityGrade {
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
