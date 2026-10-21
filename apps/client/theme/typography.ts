import type { TextStyle } from 'react-native';

import { font, type } from './tokens';

/**
 * v3.4 type roles (Lz-22 / guide §7.2 + §23 `type.*`; Lz-59 `sheetTitle` 22).
 * Lz-66: bundled Inter (SIL OFL 1.1) on every device — explicit family names
 * per weight. Do not leave `fontFamily` unset or rely on Android synthesis.
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
 * Named Inter family for a CSS/RN weight. Android must use this string —
 * `fontWeight` alone synthesizes a different face.
 */
export function fontFamilyForWeight(weight?: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '500':
      return font.family.medium;
    case '600':
      return font.family.semiBold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return font.family.bold;
    default:
      return font.family.regular;
  }
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
 * Text style for a v3.4 role. Sets `fontFamily` to the matching Inter file.
 * `lineHeight` = round(size × ratio) — unscaled; RN scales with fontSize.
 */
export function textStyle(role: TypeRole, options: TextStyleOptions = {}): TextStyle {
  const spec = ROLE_SPEC[role];
  const scale = e2eTextScale();
  const fontSize = Math.round(spec.size * scale);
  const lineHeight = Math.round(spec.size * spec.lineHeightRatio * scale);
  const fontWeight = options.fontWeight ?? spec.weight;

  return {
    fontSize,
    fontWeight,
    fontFamily: fontFamilyForWeight(fontWeight),
    lineHeight,
  };
}
