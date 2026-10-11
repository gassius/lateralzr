import { complexityCueText } from './complexityFeedback';
import {
  clampComplexity,
  MAX_CONCEPT_COMPLEXITY,
  MIN_CONCEPT_COMPLEXITY,
} from './complexityStorage';

/** Same touch target as Laterality sheet radios (guide §12.1 / Critiquito). */
export const COMPLEXITY_MENU_ROW_MIN_HEIGHT = 52;

export type ComplexityMenuRow = {
  grade: number;
  /** Localized “Complexity {n}” — never Laterality labels. */
  label: string;
  checked: boolean;
  a11yLabel: string;
};

/** Five rows in grade order 1→5 with checked flag + grade a11y name. */
export function complexityMenuRows(selected: number): ComplexityMenuRow[] {
  const current = clampComplexity(selected);
  const rows: ComplexityMenuRow[] = [];
  for (let n = MIN_CONCEPT_COMPLEXITY; n <= MAX_CONCEPT_COMPLEXITY; n += 1) {
    const label = complexityCueText(n);
    rows.push({
      grade: n,
      label,
      checked: n === current,
      a11yLabel: label,
    });
  }
  return rows;
}

/** Tap a row → that grade (caller commits via onSelectComplexity). */
export function complexityMenuCommitValue(grade: number): number {
  return clampComplexity(grade);
}
