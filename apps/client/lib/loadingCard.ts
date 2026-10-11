/**
 * Loading silhouette tokens (Lz-35 / Critiquito v3.3 §12.4).
 * Kept as a tiny module so unit tests can lock alphas without mounting RN views.
 */

/** Pattern variant 03 — edge-current (0-based index). */
export const LOADING_PATTERN_VARIANT = 2 as const;

export const LOADING_CARD_RAIL_ALPHA = 0.1;
export const LOADING_CARD_PATTERN_OPACITY = 0.1;
export const LOADING_CARD_HAIRLINE_ALPHA = 0.33;
