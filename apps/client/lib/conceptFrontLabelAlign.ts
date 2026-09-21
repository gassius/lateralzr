/**
 * Card-front concept label alignment (Critiquito Lz-04).
 *
 * Rule: wraps ⇒ left, else center.
 * A title that is estimated to stay on one line in the content box is
 * centered so short seeds ("Tide", "Lighthouse") sit in the middle of the
 * front. Titles that would wrap stay left-aligned so subsequent lines read
 * naturally. The back title is a separate style and is not affected.
 *
 * Width is estimated as `length * fontSize * AVG_GLYPH_EM` (bold 48px title).
 */
export const CONCEPT_FRONT_LABEL_FONT_SIZE = 48;

/** Mean glyph width as a fraction of fontSize for the 700-weight front title. */
export const CONCEPT_FRONT_LABEL_AVG_GLYPH_EM = 0.52;

/**
 * Fallback content width while the card has not laid out yet.
 * Matches a typical phone inner width minus card padding (~320px).
 */
export const CONCEPT_FRONT_LABEL_FALLBACK_CONTENT_WIDTH = 320;

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
