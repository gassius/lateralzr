/** Optional §5.2 intro node pulse: one cycle, glow colour, off under RM. */
export const INTRO_LOGO_PULSE_MAX_MS = 1200;

/** One terminal mark node (not a wordmark letter). */
export const INTRO_LOGO_PULSE_NODE_ID = 'path188';

/** §11.3 / §5.2 glow fill — never white, never on the wordmark. */
export const INTRO_LOGO_PULSE_FILL = '#FFC98A';

/** Peak opacity of the single intro node (matches connector glow). */
export const INTRO_LOGO_PULSE_PEAK_OPACITY = 0.55;

/** One grow + fade for the single terminal node. */
export const LOGO_ONE_CYCLE_MS = INTRO_LOGO_PULSE_MAX_MS;

/** Half of the one-cycle pulse. */
export const LOGO_PULSE_HALF_MS = INTRO_LOGO_PULSE_MAX_MS / 2;

/**
 * Minimum time the intro logo stays visible before the first concept.
 * At least one full animation cycle; task target ~3s.
 */
export const MIN_INTRO_LOGO_MS = Math.max(3000, LOGO_ONE_CYCLE_MS);

export function introLogoPulseAllowed(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

/** Recolor a white mark-node path fragment to the intro glow fill. */
export function recolouredIntroPulsePath(
  fragment: string,
  fill: string = INTRO_LOGO_PULSE_FILL,
): string {
  return fragment
    .replace(/fill:#ffffff/gi, `fill:${fill}`)
    .replace(/fill="#ffffff"/gi, `fill="${fill}"`);
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
