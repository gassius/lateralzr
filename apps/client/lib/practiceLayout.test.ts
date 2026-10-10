import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layout } from '../theme/tokens.ts';
import {
  APP_MENU_TRIGGER_ENABLED,
  PRACTICE_COLUMN_GUIDE_MIN_MAX,
  PRACTICE_COLUMN_MAX_WIDTH,
  practiceColumnWidth,
  practiceMenuTriggerSize,
  practiceScreenGutter,
} from './practiceLayout.ts';

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

  it('keeps the trigger unmounted until the menu (Lz-32) lands', () => {
    assert.equal(APP_MENU_TRIGGER_ENABLED, false);
  });
});
