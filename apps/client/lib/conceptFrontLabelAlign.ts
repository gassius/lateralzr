/**
 * Card-front concept label alignment (Critiquito Lz-04).
 *
 * Rule: wraps ⇒ left, else center.
 * One-line titles center so short seeds ("Tide", "Lighthouse") sit in the
 * middle of the front. Titles that wrap stay left-aligned so subsequent
 * lines read naturally. The back title is a separate style and is not affected.
 *
 * Source of truth at runtime is `onTextLayout` line count. The width estimate
 * is only a first-paint fallback (bold 48px title ≈ 0.58em per glyph, matching
 * measured system-ui / RN-web metrics).
 */
export const CONCEPT_FRONT_LABEL_FONT_SIZE = 48;

/** Mean glyph width as a fraction of fontSize for the 700-weight front title. */
export const CONCEPT_FRONT_LABEL_AVG_GLYPH_EM = 0.58;

/**
 * Fallback content width while the card has not laid out yet.
 * Matches the letterboxed web preview inner box (~301px at 1280×800).
 */
export const CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH = 301;

export function conceptFrontLabelTextAlignFromLineCount(lineCount: number): 'center' | 'left' {
  return lineCount > 1 ? 'left' : 'center';
}

export function conceptFrontLabelTextAlign(
  title: string,
  contentWidthPx: number,
  fontSize: number = CONCEPT_FRONT_LABEL_FONT_SIZE,
): 'center' | 'left' {
  const text = title.trim();
  if (text.length === 0) {
    return 'center';
  }
  if (text.includes('\n')) {
    return 'left';
  }

  const boxWidth =
    contentWidthPx > 0 ? contentWidthPx : CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH;
  const estimatedWidth = text.length * fontSize * CONCEPT_FRONT_LABEL_AVG_GLYPH_EM;
  return estimatedWidth <= boxWidth ? 'center' : 'left';
}
