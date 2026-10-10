/**
 * Suppress card flip briefly after wiki / credit presses (Lz-34 AC).
 * Pure helpers so the window is unit-testable without the stack.
 */

/** Tap→flip ignore window after an interactive back press (ms). */
export const FLIP_SUPPRESS_MS = 400;

/** Absolute timestamp until which `toggleFlip` must no-op. */
export function suppressUntil(now: number, windowMs: number = FLIP_SUPPRESS_MS): number {
  return now + windowMs;
}

/** True while `now` is strictly before `until` (at the boundary, flip is allowed). */
export function isFlipSuppressed(now: number, until: number): boolean {
  return now < until;
}
