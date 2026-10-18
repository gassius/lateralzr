/** Optional §5.2 intro node pulse: one cycle, glow colour, off under RM. */
export const INTRO_LOGO_PULSE_MAX_MS = 1200;

/** Delay between consecutive circle pulses. */
export const LOGO_STAGGER_MS = 160;

/** Animated white circles on the native logo. */
export const LOGO_DOT_COUNT = 4;

/**
 * Duration for all staggered circles to finish one grow+shrink pulse
 * (last circle starts at stagger*(n-1), then needs a full pulse).
 * Capped by §5.2 — one cycle ≤ `INTRO_LOGO_PULSE_MAX_MS`.
 */
export const LOGO_ONE_CYCLE_MS = INTRO_LOGO_PULSE_MAX_MS;

/** One grow + shrink for a single circle, so the last staggered dot finishes on the cap. */
export const LOGO_PULSE_MS =
  INTRO_LOGO_PULSE_MAX_MS - LOGO_STAGGER_MS * (LOGO_DOT_COUNT - 1);

/** Half of one grow or shrink step on a logo circle (native LateralzrLogo). */
export const LOGO_PULSE_HALF_MS = LOGO_PULSE_MS / 2;

/**
 * Minimum time the intro logo stays visible before the first concept.
 * At least one full animation cycle; task target ~3s.
 */
export const MIN_INTRO_LOGO_MS = Math.max(3000, LOGO_ONE_CYCLE_MS);

export function introLogoPulseAllowed(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

/** Milliseconds still needed to reach the minimum intro duration. */
export function remainingIntroMs(
  startedAtMs: number,
  nowMs: number,
  minMs: number = MIN_INTRO_LOGO_MS,
): number {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return Math.max(0, minMs - elapsed);
}
