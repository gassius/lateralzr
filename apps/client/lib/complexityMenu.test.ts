import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setActiveLocale, t } from './i18n.ts';
import {
  applyMenuComplexitySelection,
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
  it('returns the tapped grade clamped to 1–5', () => {
    assert.equal(complexityMenuCommitValue(5), 5);
    assert.equal(complexityMenuCommitValue(1), 1);
    assert.equal(complexityMenuCommitValue(0), 1);
    assert.equal(complexityMenuCommitValue(99), 5);
    assert.equal(complexityMenuCommitValue(4), 4);
  });
});

describe('applyMenuComplexitySelection', () => {
  it('clamps grade, keeps currentIndex, and always persists/prefetches', () => {
    const base = { complexity: 2, currentIndex: 3 };
    const next = applyMenuComplexitySelection(base, 5);
    assert.equal(next.complexity, 5);
    assert.equal(next.currentIndex, 3);
    assert.equal(next.currentIndex, base.currentIndex);
    assert.equal(next.persist, true);
    assert.equal(next.prefetch, true);
    assert.equal(next.complexityChanged, true);
  });

  it('clamps out-of-range grades to 1–5', () => {
    assert.equal(applyMenuComplexitySelection({ complexity: 3, currentIndex: 0 }, 0).complexity, 1);
    assert.equal(applyMenuComplexitySelection({ complexity: 3, currentIndex: 0 }, 99).complexity, 5);
  });

  it('re-picking the same grade still saves (persist + prefetch) without changing index', () => {
    const base = { complexity: 4, currentIndex: 7 };
    const same = applyMenuComplexitySelection(base, 4);
    assert.equal(same.complexity, 4);
    assert.equal(same.complexityChanged, false);
    assert.equal(same.persist, true);
    assert.equal(same.prefetch, true);
    assert.equal(same.currentIndex, 7);
  });

  it('never advances the card index even when complexity changes', () => {
    for (const index of [0, 1, 4, 12]) {
      const result = applyMenuComplexitySelection({ complexity: 1, currentIndex: index }, 5);
      assert.equal(result.currentIndex, index);
      assert.notEqual(result.complexity, 1);
    }
  });
});

describe('complexity menu layout constants', () => {
  it('row min height matches Laterality radios (52)', () => {
    assert.ok(COMPLEXITY_MENU_ROW_MIN_HEIGHT >= 48);
    assert.equal(COMPLEXITY_MENU_ROW_MIN_HEIGHT, 52);
  });
});
