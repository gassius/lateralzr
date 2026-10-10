import { type } from '../theme/tokens';
import {
  layoutConceptFrontTitle,
  measureConceptFrontTitleWidth,
  type ConceptFrontTitleLayout,
  type MeasureTitleWidth,
} from './conceptFrontTitle';

/**
 * Sheet header title (Lz-31 follow-up): same wrap policy as concept titles —
 * shrink before mid-word break; never split without a visible hyphen.
 * Paper/ink can go below the orange contrast floor (24) down to body (18).
 */

export const SHEET_TITLE_FONT_SIZE = type.sheetTitle;

/** Floor on paper — allows “Lateralidad” to fit at 320×200% without a lone-letter wrap. */
export const SHEET_TITLE_MIN_FONT_SIZE = type.body;

export const SHEET_TITLE_LINE_HEIGHT_RATIO = 1.2;

/**
 * Layout a sheet title into `maxWidth` at `fontScale` (OS × e2e).
 * Returns unscaled `fontSize` / `lineHeight` for the Text style (#82).
 */
export function layoutSheetTitle(
  text: string,
  maxWidth: number,
  measure: MeasureTitleWidth = measureConceptFrontTitleWidth,
  fontScale: number = 1,
): ConceptFrontTitleLayout {
  const layout = layoutConceptFrontTitle(
    text,
    maxWidth,
    measure,
    SHEET_TITLE_FONT_SIZE,
    SHEET_TITLE_MIN_FONT_SIZE,
    fontScale,
  );
  return {
    ...layout,
    lineHeight: Math.round(layout.fontSize * SHEET_TITLE_LINE_HEIGHT_RATIO),
  };
}
