import tokensJson from './tokens.json';
import { GUIDE_SECTION_23, type DesignTokens } from './section23';

/**
 * Art Direction v3.3 design tokens (ClickUp Lz-20 / guide §23).
 * Runtime values come from `tokens.json`; types are the §23 literal shape.
 * Logo near-black lives in `./logo` — not in `color`.
 */
/** JSON import widens arrays/strings; cast through unknown onto the §23 literal shape (M1). */
export const tokens = tokensJson as unknown as DesignTokens;

export const color = tokens.color;
export const spacing = tokens.spacing;
export const layout = tokens.layout;
export const type = tokens.type;
export const motion = tokens.motion;
export const laterality = tokens.laterality;
export const pattern = tokens.pattern;

export type { DesignTokens };
export type ColorToken = keyof typeof color;

/**
 * Usable-height threshold for `layout.cardToControlGapTall` (art director / Lz-30).
 * Not in guide §23 JSON; owned here so shell/laterality tickets share one pin.
 */
export const tallScreenMinHeight = 800 as const;

/** Re-export guide pin for tests / tooling that must not read tokens.json alone. */
export { GUIDE_SECTION_23 };
