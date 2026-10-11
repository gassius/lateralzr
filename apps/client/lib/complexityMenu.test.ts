import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setActiveLocale, t } from './i18n.ts';
import {
  COMPLEXITY_MENU_ROW_MIN_HEIGHT,
  complexityMenuCommitValue,
  complexityMenuRows,
} from './complexityMenu.ts';

describe('complexityMenuRows', () => {
  it('returns grades 1→5 (complexityStorage MIN/MAX) with a single checked row', () => {
    setActiveLocale('en');
    const rows = complexityMenuRows(3);
    assert.equal(rows.length, 5);
    assert.deepEqual(
      rows.map((r) => r.grade),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      rows.map((r) => r.checked),
      [false, false, true, false, false],
    );
    assert.equal(rows[2]?.label, t('complexityGrade', { grade: '3' }));
    assert.equal(rows[2]?.a11yLabel, t('complexityGrade', { grade: '3' }));
  });

  it('uses complexityGrade copy — never Laterality labels', () => {
    setActiveLocale('en');
    const rows = complexityMenuRows(5);
    for (const row of rows) {
      assert.match(row.label, /^Complexity \d$/);
      assert.doesNotMatch(row.label, /laterality|domain|provocation|random/i);
      assert.doesNotMatch(row.a11yLabel, /laterality|domain|provocation|random/i);
    }
    setActiveLocale('es');
    const es = complexityMenuRows(1);
    assert.match(es[0]!.label, /complejidad 1/i);
    assert.doesNotMatch(es[0]!.label, /lateralidad|dominio|provocaci/i);
    setActiveLocale('en');
  });

  it('clamps out-of-range selected onto a valid checked row', () => {
    const low = complexityMenuRows(0);
    assert.equal(low[0]?.checked, true);
    assert.equal(low[0]?.grade, 1);
    const high = complexityMenuRows(9);
    assert.equal(high[4]?.checked, true);
    assert.equal(high[4]?.grade, 5);
  });
});

describe('complexityMenuCommitValue', () => {
  it('returns the tapped grade (clamped) without advancing a deck index', () => {
    assert.equal(complexityMenuCommitValue(5), 5);
    assert.equal(complexityMenuCommitValue(1), 1);
    assert.equal(complexityMenuCommitValue(0), 1);
    assert.equal(complexityMenuCommitValue(99), 5);
    // Commit is pure grade math — callers must not bump currentIndex.
    const beforeIndex = 2;
    const afterIndex = beforeIndex;
    assert.equal(complexityMenuCommitValue(4), 4);
    assert.equal(afterIndex, beforeIndex);
  });
});

describe('complexity menu layout constants', () => {
  it('row min height matches Laterality radios (52)', () => {
    assert.ok(COMPLEXITY_MENU_ROW_MIN_HEIGHT >= 48);
    assert.equal(COMPLEXITY_MENU_ROW_MIN_HEIGHT, 52);
  });
});
