/** Half of one grow or shrink step on a logo circle (native LateralzrLogo). */
export const LOGO_PULSE_HALF_MS = 380;

/** One grow + shrink for a single circle. */
export const LOGO_PULSE_MS = LOGO_PULSE_HALF_MS * 2;

/** Delay between consecutive circle pulses. */
export const LOGO_STAGGER_MS = 160;

/** Animated white circles on the native logo. */
export const LOGO_DOT_COUNT = 4;

/**
 * Duration for all staggered circles to finish one grow+shrink pulse
 * (last circle starts at stagger*(n-1), then needs a full pulse).
 */
export const LOGO_ONE_CYCLE_MS = LOGO_STAGGER_MS * (LOGO_DOT_COUNT - 1) + LOGO_PULSE_MS;
