import type { TextStyle } from 'react-native';

import { type } from './tokens';

/**
 * v3.3 type roles (Lz-22 / guide §7.2 + §23 `type.*`).
 * Platform system sans — leave `fontFamily` unset (never `'System'` on web).
 * Absolute `lineHeight` is scaled by `fontScale` so OS text size does not overlap lines.
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
  /** Defaults to 1. Pass `PixelRatio.getFontScale()` at render for OS text scaling. */
  fontScale?: number;
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
 * Text style for a v3.3 role. Does not set `fontFamily`.
 * `lineHeight` = round(size × ratio × fontScale).
 */
export function textStyle(role: TypeRole, options: TextStyleOptions = {}): TextStyle {
  const spec = ROLE_SPEC[role];
  const fontScale = options.fontScale ?? 1;
  const fontSize = spec.size;
  const lineHeight = Math.round(fontSize * spec.lineHeightRatio * fontScale);

  return {
    fontSize,
    fontWeight: options.fontWeight ?? spec.weight,
    lineHeight,
  };
}
