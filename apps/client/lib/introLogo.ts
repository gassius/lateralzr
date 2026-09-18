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

/**
 * Minimum time the intro logo stays visible before the first concept.
 * At least one full animation cycle; task target ~3s.
 */
export const MIN_INTRO_LOGO_MS = Math.max(3000, LOGO_ONE_CYCLE_MS);

/** Milliseconds still needed to reach the minimum intro duration. */
export function remainingIntroMs(
  startedAtMs: number,
  nowMs: number,
  minMs: number = MIN_INTRO_LOGO_MS,
): number {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return Math.max(0, minMs - elapsed);
}

export function waitMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
