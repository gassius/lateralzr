/**
 * Complexity bar helpers (Lz-67 / guide §9.7). Mirrors Laterality rail math
 * on the 1–5 grade scale; labels use complexity i18n, not Laterality grades.
 */

import { complexityCueText } from './complexityFeedback';
import { t } from './i18n';

export const MIN_COMPLEXITY = 1;
export const MAX_COMPLEXITY = 5;

export type ComplexityGrade = 1 | 2 | 3 | 4 | 5;

export type ComplexityControlGate = {
  /** True while a laterality reshuffle is in flight — rail commits are inert. */
  swapping?: boolean;
};

export function clampComplexityGrade(value: number): ComplexityGrade {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return 3;
  return Math.min(MAX_COMPLEXITY, Math.max(MIN_COMPLEXITY, n)) as ComplexityGrade;
}

/**
 * Map a horizontal position inside a rail of `width` onto the nearest of 5 grades.
 * Same discrete mapping as {@link lateralityStepFromX}.
 */
export function complexityStepFromX(x: number, width: number): ComplexityGrade {
  if (!(width > 0) || !Number.isFinite(x)) return 3;
  const clamped = Math.min(Math.max(x, 0), width);
  const index = Math.min(
    MAX_COMPLEXITY - 1,
    Math.floor((clamped / width) * MAX_COMPLEXITY),
  );
  return (index + 1) as ComplexityGrade;
}

export function complexityCommitFromRail(
  x: number,
  width: number,
  gate: ComplexityControlGate = {},
): ComplexityGrade | null {
  if (gate.swapping) return null;
  return complexityStepFromX(x, width);
}

export function complexityNextFromControlInput(
  grade: number,
  actionOrKey: string,
  gate: ComplexityControlGate = {},
): ComplexityGrade | null {
  if (gate.swapping) return null;
  const current = clampComplexityGrade(grade);
  let delta: -1 | 1 | null = null;
  if (
    actionOrKey === 'increment' ||
    actionOrKey === 'ArrowRight' ||
    actionOrKey === 'ArrowUp'
  ) {
    delta = 1;
  } else if (
    actionOrKey === 'decrement' ||
    actionOrKey === 'ArrowLeft' ||
    actionOrKey === 'ArrowDown'
  ) {
    delta = -1;
  }
  if (delta == null) return null;
  const next = clampComplexityGrade(current + delta);
  return next === current ? null : next;
}

/** Visible label: "Complexity 2" / "Complejidad 2". */
export function complexityBarLabel(grade: number): string {
  return complexityCueText(clampComplexityGrade(grade));
}

/**
 * Accessible value: "Complexity, 2 of 5" / "Complejidad, 2 de 5".
 * Uses the same "{label}, {n} of 5" shape as Laterality.
 */
export function complexityA11yText(grade: number): string {
  const n = clampComplexityGrade(grade);
  return t('complexityA11yValue', {
    label: t('menuComplexity'),
    n: String(n),
  });
}
