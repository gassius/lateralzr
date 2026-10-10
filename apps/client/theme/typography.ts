import type { TextStyle } from 'react-native';

import { type } from './tokens';

/**
 * v3.3 type roles (Lz-22 / guide §7.2 + §23 `type.*`).
 * Platform system sans — leave `fontFamily` unset (never `'System'` on web).
 *
 * Return unscaled `fontSize` / `lineHeight`. React Native already multiplies both
 * by the OS font-size multiplier when `allowFontScaling` is on — do not pre-scale
 * `lineHeight` or native text gets ~4× leading at 200% OS size.
 */
export type TypeRole =
  | 'concept'
  | 'sheetTitle'
  | 'body'
  | 'row'
  | 'label'
  | 'meta';

type RoleSpec = {
  size: number;
  weight: NonNullable<TextStyle['fontWeight']>;
  lineHeightRatio: number;
};

const ROLE_SPEC: Record<TypeRole, RoleSpec> = {
  /** Front title token; layout/alignment owned by Lz-26. */
  concept: { size: type.concept, weight: '700', lineHeightRatio: 1.15 },
  sheetTitle: { size: type.sheetTitle, weight: '700', lineHeightRatio: 1.2 },
  body: { size: type.body, weight: '400', lineHeightRatio: 1.5 },
  row: { size: type.row, weight: '500', lineHeightRatio: 1.4 },
  label: { size: type.label, weight: '500', lineHeightRatio: 1.4 },
  meta: { size: type.meta, weight: '400', lineHeightRatio: 1.4 },
};

export type TextStyleOptions = {
  fontWeight?: TextStyle['fontWeight'];
};

/** Unscaled px size for a role (from §23 tokens). */
export function typeSize(role: TypeRole): number {
  return ROLE_SPEC[role].size;
}

/** Default weight for a role. */
export function typeWeight(role: TypeRole): NonNullable<TextStyle['fontWeight']> {
  return ROLE_SPEC[role].weight;
}

/** Line-height ratio for a role (§7.2 pick). */
export function typeLineHeightRatio(role: TypeRole): number {
  return ROLE_SPEC[role].lineHeightRatio;
}

/**
 * Web E2E only: `?e2eTextScale=2` multiplies fontSize and lineHeight together
 * (same joint scale RN applies natively). Ignored in product use / native.
 */
function e2eTextScale(): number {
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') {
    return 1;
  }
  try {
    const raw = new URLSearchParams(window.location.search).get('e2eTextScale');
    if (raw == null || raw === '') return 1;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 4) return 1;
    return n;
  } catch {
    return 1;
  }
}

/**
 * Text style for a v3.3 role. Does not set `fontFamily`.
 * `lineHeight` = round(size × ratio) — unscaled; RN scales with fontSize.
 */
export function textStyle(role: TypeRole, options: TextStyleOptions = {}): TextStyle {
  const spec = ROLE_SPEC[role];
  const scale = e2eTextScale();
  const fontSize = Math.round(spec.size * scale);
  const lineHeight = Math.round(spec.size * spec.lineHeightRatio * scale);

  return {
    fontSize,
    fontWeight: options.fontWeight ?? spec.weight,
    lineHeight,
  };
}
