/**
 * Practice-screen shell layout (ClickUp Lz-67 / guide §9.1, §8, §9.7, §16).
 * Header row (wordmark + ⋯) + Complexity bar + equal card gaps.
 */

import { LABEL_GLYPH_TOP_INSET } from '@/lib/lateralityChrome';
import { header, layout } from '@/theme/tokens';

/** Upper bound of the guided 440–480 px practice column. */
export const PRACTICE_COLUMN_MAX_WIDTH = 480;

/** Lower end of the guided starting maximum (documentation / tests). */
export const PRACTICE_COLUMN_GUIDE_MIN_MAX = 440;

/** Horizontal inset for card stack + header edges (token). */
export function practiceScreenGutter(): number {
  return layout.screenGutter;
}

/**
 * Horizontal inset aligning chrome with the card's left/right edges
 * (guide §9.7 — wordmark / ⋯ align to card stack gutter, not screen gutter).
 */
export function practiceCardEdgeInset(): number {
  return layout.cardStackGutter;
}

/** Recommended menu-trigger hit area (token). */
export function practiceMenuTriggerSize(): number {
  return layout.recommendedTouchTarget;
}

/** Wordmark display height on petrol (guide §9.7 / header.wordmark.heightPt). */
export function practiceWordmarkHeight(): number {
  return header.wordmark.heightPt;
}

/** Gap from wordmark outline bottom → Complexity label top (§9.7). */
export function practiceWordmarkToComplexityGap(): number {
  return header.wordmarkToComplexityLabel;
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

/**
 * Header row band below the top safe area (wordmark + ⋯).
 * Reserves the 48 pt menu touch target; wordmark (~20 pt) optically aligns inside.
 */
export function practiceHeaderRowHeight(): number {
  if (!APP_MENU_TRIGGER_ENABLED) return practiceWordmarkHeight();
  return Math.max(practiceWordmarkHeight(), practiceMenuTriggerSize());
}

/**
 * Optical top offset of the wordmark inside the 48 pt header row (§9.7).
 * Centres the ⋯ dots on the short-letter x-height band (not the ascender box).
 */
export const WORDMARK_X_HEIGHT_CENTRE_RATIO = 0.58;

export function practiceWordmarkTopOffset(
  rowHeight: number = practiceHeaderRowHeight(),
  wordmarkHeight: number = practiceWordmarkHeight(),
): number {
  const row = Number.isFinite(rowHeight) ? Math.max(0, rowHeight) : 0;
  const h = Number.isFinite(wordmarkHeight) ? Math.max(0, wordmarkHeight) : 0;
  return Math.max(0, row / 2 - h * WORDMARK_X_HEIGHT_CENTRE_RATIO);
}

/**
 * Content offset from the top safe-area edge to the Complexity **label row**.
 * Guide §9.7: 24 pt from the wordmark’s visible bottom to the **glyph caps**
 * (not the text line-box). Subtract {@link LABEL_GLYPH_TOP_INSET} so the
 * letters land at wordmarkBottom + 24.
 */
export function practiceHeaderToComplexityOffset(
  rowHeight: number = practiceHeaderRowHeight(),
  wordmarkHeight: number = practiceWordmarkHeight(),
  gap: number = practiceWordmarkToComplexityGap(),
): number {
  const g = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  return (
    practiceWordmarkTopOffset(rowHeight, wordmarkHeight) +
    Math.max(0, wordmarkHeight) +
    g -
    LABEL_GLYPH_TOP_INSET
  );
}
