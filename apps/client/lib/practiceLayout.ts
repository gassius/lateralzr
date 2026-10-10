/**
 * Practice-screen shell layout (ClickUp Lz-21 / guide §9.1, §8, §16).
 * Centred column + screen gutters. Menu trigger chrome lives here for Lz-32 to enable.
 */

import { layout } from '@/theme/tokens';

/** Upper bound of the guided 440–480 px practice column. */
export const PRACTICE_COLUMN_MAX_WIDTH = 480;

/** Lower end of the guided starting maximum (documentation / tests). */
export const PRACTICE_COLUMN_GUIDE_MIN_MAX = 440;

/** Horizontal inset for card stack + control row (token). */
export function practiceScreenGutter(): number {
  return layout.screenGutter;
}

/** Recommended menu-trigger hit area (token). */
export function practiceMenuTriggerSize(): number {
  return layout.recommendedTouchTarget;
}

/**
 * Width of the practice column for a given viewport (or phone-frame) width.
 * Caps at {@link PRACTICE_COLUMN_MAX_WIDTH}; never stretches into a billboard.
 */
export function practiceColumnWidth(viewportWidth: number): number {
  const w = Number.isFinite(viewportWidth) ? Math.max(0, Math.floor(viewportWidth)) : 0;
  return Math.min(w, PRACTICE_COLUMN_MAX_WIDTH);
}

/**
 * §4.5 — only show controls that work. Enabled with Lz-32 (app menu + Replay row).
 */
export const APP_MENU_TRIGGER_ENABLED = true;
