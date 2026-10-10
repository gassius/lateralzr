/**
 * Pattern-master paint (Lz-25 / guide §6.3 + §11.2).
 * These are pattern-only constants — keep them out of UI `color` tokens.
 * The production SVGs already bake these values in; this module documents them
 * for Lz-40 pulse work and for tests that must not invent alternate hexes.
 */

export const PATTERN_CARD_FILL = '#F78D1E';

export const PATTERN_RELIEF = {
  shade: { fill: '#C9670F', opacity: 0.34, offsetX: -0.6, offsetY: -0.6 },
  highlight: { fill: '#FFB867', opacity: 0.6, offsetX: 0.7, offsetY: 0.7 },
  core: { fill: '#EC8318', opacity: 0.45, offsetX: 0, offsetY: 0 },
} as const;

/** Pulse-glow fill on `#connectors` (Lz-40 animates opacity only). */
export const PATTERN_PULSE_GLOW_FILL = '#FFB867';

/** Card design units shared by all three pattern SVGs. */
export const PATTERN_CARD_UNITS = {
  width: 358,
  height: 560,
} as const;

/** Margin around the measured title box when clearing motifs (Carlos / Critiquito). */
export const PATTERN_TITLE_CLEAR_MARGIN_PX = 16;
