import tokensJson from './tokens.json';
import { GUIDE_SECTION_23, type DesignTokens } from './section23';

/**
 * Art Direction v3.5 design tokens (ClickUp Lz-67 / guide §23).
 * Runtime values come from `tokens.json`; types are the §23 literal shape.
 * Logo near-black lives in `./logo` — not in `color`.
 */
/** JSON import widens arrays/strings; cast through unknown onto the §23 literal shape (M1). */
export const tokens = tokensJson as unknown as DesignTokens;

export const color = tokens.color;
export const spacing = tokens.spacing;
export const layout = tokens.layout;
export const type = tokens.type;
export const font = tokens.font;
export const motion = tokens.motion;
export const laterality = tokens.laterality;
export const pattern = tokens.pattern;
export const shadow = tokens.shadow;
export const decorative = tokens.decorative;
export const cardAspect = tokens.cardAspect;
export const media = tokens.media;
export const build = tokens.build;
export const webPreview = tokens.webPreview;
export const header = tokens.header;
export const complexityBar = tokens.complexityBar;
export const sound = tokens.sound;

export type { DesignTokens };
export type ColorToken = keyof typeof color;

/** Re-export guide pin for tests / tooling that must not read tokens.json alone. */
export { GUIDE_SECTION_23 };
