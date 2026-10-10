import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setActiveLocale, t } from './i18n.ts';
import { motion } from '../theme/tokens.ts';
import {
  lateralitySheetCommitValue,
  lateralitySheetDismissValue,
  lateralitySheetRows,
  LATERALITY_SHEET_ROW_MIN_HEIGHT,
  sheetMotionDurationMs,
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

describe('lateralitySheet dismiss vs commit', () => {
  it('dismiss leaves the current value unchanged', () => {
    assert.equal(lateralitySheetDismissValue(3), 3);
    assert.equal(lateralitySheetDismissValue(1), 1);
    assert.equal(lateralitySheetDismissValue(5), 5);
  });

  it('commit returns the tapped grade (clamped)', () => {
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
  it('row min height meets the 48 px touch target (render uses 52)', () => {
    assert.ok(LATERALITY_SHEET_ROW_MIN_HEIGHT >= 48);
    assert.equal(LATERALITY_SHEET_ROW_MIN_HEIGHT, 52);
  });
});
