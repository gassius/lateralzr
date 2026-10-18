import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setActiveLocale, t } from './i18n.ts';
import { color, layout, motion } from '../theme/tokens.ts';
import {
  lateralityMiniRailSelectedDot,
  lateralitySheetCommitValue,
  lateralitySheetRows,
  LATERALITY_MINI_RAIL_DOT_COUNT,
  LATERALITY_MINI_RAIL_HEIGHT,
  LATERALITY_SHEET_RADIO_SIZE,
  LATERALITY_SHEET_ROW_MIN_HEIGHT,
  LATERALITY_SHEET_ROW_RADIUS,
  SHEET_BACKDROP_ALPHA,
  sheetMotionDurationMs,
  sheetScrimAlpha,
} from './lateralitySheet.ts';

describe('lateralitySheetRows', () => {
  it('returns grades 1→5 with a single checked row', () => {
    setActiveLocale('en');
    const rows = lateralitySheetRows(4);
    assert.equal(rows.length, 5);
    assert.deepEqual(
      rows.map((r) => r.grade),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      rows.map((r) => r.checked),
      [false, false, false, true, false],
    );
    assert.equal(rows[3]?.labelKey, 'lateralityGrade4');
    assert.equal(rows[3]?.a11yLabel, t('lateralityA11yValue', { label: 'Provocation', n: '4' }));
  });

  it('localizes a11y “n of 5” / “n de 5”', () => {
    setActiveLocale('es');
    const rows = lateralitySheetRows(2);
    assert.equal(
      rows[1]?.a11yLabel,
      t('lateralityA11yValue', { label: 'Contexto compartido', n: '2' }),
    );
    assert.match(rows[1]!.a11yLabel, /2 de 5/);
    setActiveLocale('en');
    assert.match(lateralitySheetRows(2)[1]!.a11yLabel, /2 of 5/);
  });

  it('clamps out-of-range selected onto a valid checked row', () => {
    const low = lateralitySheetRows(0);
    assert.equal(low[0]?.checked, true);
    const high = lateralitySheetRows(9);
    assert.equal(high[4]?.checked, true);
  });
});

describe('lateralitySheetCommitValue', () => {
  it('returns the tapped grade (clamped)', () => {
    assert.equal(lateralitySheetCommitValue(5), 5);
    assert.equal(lateralitySheetCommitValue(0), 1);
    assert.equal(lateralitySheetCommitValue(99), 5);
  });
});

describe('sheetMotionDurationMs', () => {
  it('uses motion.sheetMs when motion is allowed', () => {
    assert.equal(sheetMotionDurationMs(false), motion.sheetMs);
    assert.equal(motion.sheetMs, 280);
  });

  it('fades or is instant under reduced motion (no slide duration)', () => {
    assert.equal(sheetMotionDurationMs(true), motion.reducedMotionCrossfadeMs);
    assert.equal(sheetMotionDurationMs(true, true), 0);
    assert.ok(sheetMotionDurationMs(true) < motion.sheetMs);
  });
});

describe('laterality sheet layout constants', () => {
  it('row min height is 56 (sheetRowHeight) and radios use 24 / radius 14', () => {
    assert.ok(LATERALITY_SHEET_ROW_MIN_HEIGHT >= 56);
    assert.equal(LATERALITY_SHEET_ROW_MIN_HEIGHT, layout.sheetRowHeight);
    assert.equal(LATERALITY_SHEET_RADIO_SIZE, 24);
    assert.equal(LATERALITY_SHEET_ROW_RADIUS, 14);
  });

  it('scrim is color.scrim (~45% black)', () => {
    assert.equal(color.scrim, '#00000073');
    assert.equal(sheetScrimAlpha(), 0x73 / 255);
    assert.equal(SHEET_BACKDROP_ALPHA, 0x73 / 255);
    assert.ok(Math.abs(SHEET_BACKDROP_ALPHA - 0.45) < 0.002);
  });

  it('mini rail is a 5-dot echo of the selected grade', () => {
    assert.equal(LATERALITY_MINI_RAIL_DOT_COUNT, 5);
    assert.ok(LATERALITY_MINI_RAIL_HEIGHT < 48);
    assert.equal(lateralityMiniRailSelectedDot(4), 4);
    assert.equal(lateralityMiniRailSelectedDot(0), 1);
    assert.equal(lateralityMiniRailSelectedDot(9), 5);
  });
});
