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
 * One-shot fallback if header `onLayout` never yields a positive width (B2).
 * Matches concept-title native measure fallback cadence (#84).
 */
export const SHEET_TITLE_MEASURE_FALLBACK_MS = 100;

/** Measure / reveal state for the sheet title host (m1 + B2 + AD no-resize). */
export type SheetTitleMeasureState = {
  /** Latest onLayout width (0 until a positive measure, unless frozen at 0). */
  pendingWidth: number;
  /** True after the one-shot fallback timer. */
  timedOut: boolean;
  /**
   * Width locked into the first visible frame. Once set, later onLayout must not
   * change layout (AD: no visible resize/rewrap after opacity 1 — same as #84).
   */
  frozenWidth: number | null;
};

export function initialSheetTitleMeasureState(): SheetTitleMeasureState {
  return { pendingWidth: 0, timedOut: false, frozenWidth: null };
}

/**
 * Title host opacity while waiting for column width (m1/B2).
 * Hidden until a positive width or the fallback timeout — never forever.
 */
export function sheetTitleHostOpacity(state: SheetTitleMeasureState): 0 | 1 {
  if (state.frozenWidth !== null) return 1;
  return state.pendingWidth > 0 || state.timedOut ? 1 : 0;
}

/** Width fed to `layoutSheetTitle` — frozen once the title is shown. */
export function sheetTitleLayoutWidth(state: SheetTitleMeasureState): number {
  return state.frozenWidth ?? state.pendingWidth;
}

export type SheetTitleMeasureEvent =
  | { type: 'reset' }
  | { type: 'layout'; width: number }
  | { type: 'timeout' };

/**
 * Pure measure reducer. Freezes width on the first reveal (positive layout or
 * timeout) so a late onLayout cannot resize/rewrap a visible title.
 */
export function reduceSheetTitleMeasure(
  state: SheetTitleMeasureState,
  event: SheetTitleMeasureEvent,
): SheetTitleMeasureState {
  if (event.type === 'reset') {
    return initialSheetTitleMeasureState();
  }

  if (event.type === 'layout') {
    if (state.frozenWidth !== null) {
      // Already visible — ignore late width (AD / #84).
      return state;
    }
    const pendingWidth = event.width;
    if (pendingWidth > 0) {
      return { pendingWidth, timedOut: state.timedOut, frozenWidth: pendingWidth };
    }
    return { ...state, pendingWidth };
  }

  // timeout
  if (state.frozenWidth !== null) {
    return { ...state, timedOut: true };
  }
  return {
    pendingWidth: state.pendingWidth,
    timedOut: true,
    frozenWidth: state.pendingWidth,
  };
}

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
