/**
 * Shared reduced-motion gate (ClickUp Lz-34 / 869ff5gcb).
 *
 * Pure helpers for first-paint + duration/branch decisions. React subscription
 * lives in `hooks/useReducedMotion`. Sheets (Lz-31) and other surfaces should
 * consume these rather than re-reading matchMedia / AccessibilityInfo.
 */

import { motion } from '@/theme/tokens';

/** Opacity cross-fade under RM (token: motion.reducedMotionCrossfadeMs). */
export const REDUCED_MOTION_CROSSFADE_MS = motion.reducedMotionCrossfadeMs;

/** Sheet slide duration when motion is allowed (token: motion.sheetMs). */
export const SHEET_MS = motion.sheetMs;

/** Control-state change duration (token: motion.controlMs). */
export const CONTROL_MS = motion.controlMs;

/**
 * Sync `matchMedia` on web. `null` on native / when matchMedia is missing
 * (Hermes has `window` but typically no matchMedia).
 */
export function readWebPrefersReducedMotion(): boolean | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return null;
  }
}

/**
 * First-paint Reduce Motion flag.
 * Web: live matchMedia. Native / unknown: optimistic ON so a Reduce Motion
 * user never sees a full motion path before AccessibilityInfo resolves.
 */
export function resolveInitialReducedMotion(webMatchMedia: boolean | null): boolean {
  return webMatchMedia ?? true;
}

export function initialPrefersReducedMotion(): boolean {
  return resolveInitialReducedMotion(readWebPrefersReducedMotion());
}

/** Sheet appear: no slide under RM (instant). Otherwise token sheetMs. */
export function sheetAppearDurationMs(reduceMotion: boolean): number {
  return reduceMotion ? 0 : SHEET_MS;
}

/** Sheets must not translate under reduced motion. */
export function sheetUsesSlide(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

/**
 * Connector / logo pulse. Token `pulseUnderReducedMotion` is false — pulse
 * stays off when OS (or future in-app) Reduce Motion is on.
 */
export function shouldPulse(reduceMotion: boolean): boolean {
  return reduceMotion ? motion.pulseUnderReducedMotion : true;
}
