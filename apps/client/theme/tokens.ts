import tokensJson from './tokens.json';

/**
 * Art Direction v3.3 design tokens (ClickUp Lz-20 / guide §23).
 * Single source for color, spacing, layout, type, motion, laterality, pattern.
 * Logo near-black lives in `./logo` — not in `color`.
 */
export const tokens = tokensJson;

export const color = tokens.color;
export const spacing = tokens.spacing;
export const layout = tokens.layout;
export const type = tokens.type;
export const motion = tokens.motion;
export const laterality = tokens.laterality;
export const pattern = tokens.pattern;

export type DesignTokens = typeof tokens;
export type ColorToken = keyof typeof color;
