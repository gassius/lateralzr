import { color } from '../theme/tokens';

/**
 * Card-front concept title presentation (ClickUp 869f64082).
 *
 * Every title is optically centered as a block: single-line seeds and
 * multiline wraps both use `textAlign: 'center'`. Lz-04 only centered
 * short one-line labels; wraps were left-aligned and read left-heavy.
 * The back title is a separate style and is not affected.
 *
 * Color is UI ink from the theme tokens, not logo near-black and not
 * concept teal, so the title stays distinct from the shell on the orange card.
 */
export const CONCEPT_FRONT_LABEL_FONT_SIZE = 48;

export const CONCEPT_FRONT_LABEL_TEXT_ALIGN = 'center' as const;

export const CONCEPT_FRONT_LABEL_COLOR = color.ink;
