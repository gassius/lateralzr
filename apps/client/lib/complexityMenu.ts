import { t } from './i18n';

/**
 * Picker grade bounds — keep equal to complexityStorage
 * {@link MIN_CONCEPT_COMPLEXITY} / {@link MAX_CONCEPT_COMPLEXITY}.
 * (complexityStorage pulls AsyncStorage and cannot be imported from tsx unit tests.)
 */
const MIN_GRADE = 1;
const MAX_GRADE = 5;

/** Same touch target as Laterality sheet radios (guide §12.1 / Critiquito). */
export const COMPLEXITY_MENU_ROW_MIN_HEIGHT = 52;

export type ComplexityMenuRow = {
  grade: number;
  /** Localized “Complexity {n}” — never Laterality labels. */
  label: string;
  checked: boolean;
  a11yLabel: string;
};

function clampMenuComplexity(value: number): number {
  return Math.min(MAX_GRADE, Math.max(MIN_GRADE, Math.round(value)));
}

/** Five rows in grade order 1→5 with checked flag + grade a11y name. */
export function complexityMenuRows(selected: number): ComplexityMenuRow[] {
  const current = clampMenuComplexity(selected);
  const rows: ComplexityMenuRow[] = [];
  for (let n = MIN_GRADE; n <= MAX_GRADE; n += 1) {
    const label = t('complexityGrade', { grade: String(n) });
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
  return clampMenuComplexity(grade);
}
