/**
 * Shared reduced-motion gate (ClickUp Lz-34 / 869ff5gcb + Lz-46).
 *
 * Pure helpers for first-paint + duration/branch decisions, plus in-app Motion
 * preference resolution. React subscription lives in `hooks/useReducedMotion`.
 * Sheets (Lz-31) and other surfaces should consume these rather than
 * re-reading matchMedia / AccessibilityInfo.
 */

import type { MotionPreference } from '@/lib/motionStorage';
import { motion } from '@/theme/tokens';

/** Opacity cross-fade under RM (token: motion.reducedMotionCrossfadeMs). */
export const REDUCED_MOTION_CROSSFADE_MS = motion.reducedMotionCrossfadeMs;

/** Sheet slide duration when motion is allowed (token: motion.sheetMs). */
export const SHEET_MS = motion.sheetMs;

/** Control-state change duration (token: motion.controlMs). */
export const CONTROL_MS = motion.controlMs;

export type ResolveReducedMotionInput = {
  /** Native AccessibilityInfo / OS reduce-motion flag. */
  os: boolean;
  /**
   * Web `prefers-reduced-motion` matchMedia result.
   * `null` when unavailable (native / no matchMedia).
   */
  web: boolean | null;
  /** In-app Motion preference; omit / undefined treated as System. */
  appPref?: MotionPreference | null;
};

/**
 * Resolve whether the app should use reduced motion.
 *
 * - OS or web reduce-motion on → reduced always
 * - else appPref Reduced → reduced
 * - System or Full (or unset) → full motion
 */
export function resolveReducedMotion({
  os,
  web,
  appPref,
}: ResolveReducedMotionInput): boolean {
  if (os || web === true) return true;
  return appPref === 'reduced';
}

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
