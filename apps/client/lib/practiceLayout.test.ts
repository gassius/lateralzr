import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layout } from '../theme/tokens.ts';
import {
  APP_MENU_TRIGGER_ENABLED,
  PRACTICE_COLUMN_GUIDE_MIN_MAX,
  PRACTICE_COLUMN_MAX_WIDTH,
  practiceColumnWidth,
  practiceMenuChromeHeight,
  practiceMenuTriggerSize,
  practiceScreenGutter,
} from './practiceLayout.ts';
import { resolveNativeCardLayout } from './cardLayout.ts';
import {
  CONTROL_MESSAGING_BAND_HEIGHT,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  lateralityCardGap,
} from './lateralityChrome.ts';

describe('practiceLayout shell column', () => {
  it('uses the 16 px screen gutter token', () => {
    assert.equal(practiceScreenGutter(), 16);
    assert.equal(practiceScreenGutter(), layout.screenGutter);
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

describe('practiceLayout menu trigger slot', () => {
  it('reserves a 48 px hit target from the layout token', () => {
    assert.equal(practiceMenuTriggerSize(), 48);
    assert.equal(practiceMenuTriggerSize(), layout.recommendedTouchTarget);
  });

  it('mounts the trigger once the app menu (Lz-32) lands', () => {
    assert.equal(APP_MENU_TRIGGER_ENABLED, true);
  });

  it('reserves a 48 px petrol band above the card for the ellipsis', () => {
    assert.equal(practiceMenuChromeHeight(), 48);
    assert.equal(practiceMenuChromeHeight(), practiceMenuTriggerSize());
  });

  it('feeds the 390 column into the v3.4 aspect helper', () => {
    const column = practiceColumnWidth(390);
    assert.equal(column, 390);
    const menu = practiceMenuChromeHeight();
    const usable = 844 - 47 - 34 - menu;
    const layout = resolveNativeCardLayout({
      columnWidth: column,
      screenHeight: 844,
      insetTop: 47,
      insetBottom: 34,
      menuBandHeight: menu,
      cardGap: lateralityCardGap(usable),
      messagingBandHeight: CONTROL_MESSAGING_BAND_HEIGHT,
      lateralityLabelAndRailHeight: LATERALITY_LABEL_ROW_HEIGHT + LATERALITY_RAIL_HEIGHT,
    });
    assert.ok(layout.aspect >= 1.3);
    assert.ok(layout.aspect <= 1.5);
    assert.ok(layout.topSurplus > 0);
  });
});
