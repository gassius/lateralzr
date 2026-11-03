import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { header, layout } from '../theme/tokens.ts';
import {
  APP_MENU_TRIGGER_ENABLED,
  PRACTICE_COLUMN_GUIDE_MIN_MAX,
  PRACTICE_COLUMN_MAX_WIDTH,
  practiceCardEdgeInset,
  practiceColumnWidth,
  practiceHeaderRowHeight,
  practiceHeaderToComplexityOffset,
  practiceMenuTriggerSize,
  practiceScreenGutter,
  practiceWordmarkHeight,
  practiceWordmarkTopOffset,
  practiceWordmarkToComplexityGap,
  WORDMARK_X_HEIGHT_CENTRE_RATIO,
} from './practiceLayout.ts';
import { resolveNativeCardLayout } from './cardLayout.ts';
import {
  COMPLEXITY_CONTROL_HEIGHT,
  LATERALITY_CONTROL_HEIGHT,
} from './lateralityChrome.ts';

describe('practiceLayout shell column', () => {
  it('uses the 16 px screen gutter token', () => {
    assert.equal(practiceScreenGutter(), 16);
    assert.equal(practiceScreenGutter(), layout.screenGutter);
  });

  it('aligns header edges to the card stack gutter (12)', () => {
    assert.equal(practiceCardEdgeInset(), 12);
    assert.equal(practiceCardEdgeInset(), layout.cardStackGutter);
  });

  it('keeps the practice column within the 440–480 guide band', () => {
    assert.equal(PRACTICE_COLUMN_MAX_WIDTH, 480);
    assert.equal(PRACTICE_COLUMN_GUIDE_MIN_MAX, 440);
    assert.ok(PRACTICE_COLUMN_MAX_WIDTH >= PRACTICE_COLUMN_GUIDE_MIN_MAX);
    assert.ok(PRACTICE_COLUMN_MAX_WIDTH <= 480);
  });

  it('caps at 480 and centres content at tablet/desktop widths', () => {
    assert.equal(practiceColumnWidth(1280), 480);
    assert.equal(practiceColumnWidth(480), 480);
    assert.equal(practiceColumnWidth(390), 390);
    assert.equal(practiceColumnWidth(320), 320);
    assert.ok(practiceColumnWidth(1280) <= 480);
  });

  it('treats non-finite widths as empty', () => {
    assert.equal(practiceColumnWidth(Number.NaN), 0);
    assert.equal(practiceColumnWidth(-40), 0);
  });
});

describe('practiceLayout header (Lz-67)', () => {
  it('reserves a 48 px hit target from the layout token', () => {
    assert.equal(practiceMenuTriggerSize(), 48);
    assert.equal(practiceMenuTriggerSize(), layout.recommendedTouchTarget);
  });

  it('mounts the trigger once the app menu (Lz-32) lands', () => {
    assert.equal(APP_MENU_TRIGGER_ENABLED, true);
  });

  it('pins wordmark height and 24 pt gap to Complexity', () => {
    assert.equal(practiceWordmarkHeight(), 20);
    assert.equal(practiceWordmarkHeight(), header.wordmark.heightPt);
    assert.equal(practiceWordmarkToComplexityGap(), 24);
    assert.equal(practiceWordmarkToComplexityGap(), header.wordmarkToComplexityLabel);
  });

  it('reserves a 48 px header row for the menu touch target', () => {
    assert.equal(practiceHeaderRowHeight(), 48);
  });

  it('measures 24 pt from the wordmark visible bottom to glyph caps, not the 48 pt row', () => {
    assert.equal(WORDMARK_X_HEIGHT_CENTRE_RATIO, 0.58);
    const top = practiceWordmarkTopOffset();
    assert.equal(top, 48 / 2 - 20 * 0.58);
    const offset = practiceHeaderToComplexityOffset();
    // wordmarkTop + 20 + 24 − glyph inset (4.5) — letters at wordmarkBottom + 24.
    assert.equal(offset, top + 20 + 24 - 4.5);
    assert.ok(offset < practiceHeaderRowHeight() + practiceWordmarkToComplexityGap());
    assert.ok(Math.abs(offset - 51.9) < 1e-9);
  });

  it('feeds the 390 column into the v3.5 aspect helper with equal visible gaps', () => {
    const column = practiceColumnWidth(390);
    assert.equal(column, 390);
    const result = resolveNativeCardLayout({
      columnWidth: column,
      screenHeight: 844,
      insetTop: 47,
      insetBottom: 34,
      headerToComplexityOffset: practiceHeaderToComplexityOffset(),
      complexityBarHeight: COMPLEXITY_CONTROL_HEIGHT,
      lateralityLabelAndRailHeight: LATERALITY_CONTROL_HEIGHT,
    });
    assert.ok(result.aspect >= 1.3);
    assert.ok(result.aspect <= 1.5);
    assert.ok(result.topSurplus >= 0);
    assert.ok(result.bottomSurplus >= 0);
    assert.equal(result.aspect, 1.4);
  });
});
