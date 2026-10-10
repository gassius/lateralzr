import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DeckConcept } from './conceptDeck.ts';
import { setActiveLocale, t } from './i18n.ts';
import {
  applyLateralityTreeSwap,
  clampLaterality,
  DEFAULT_LATERALITY,
  LATERALITY_LABEL_KEYS,
  lateralityA11yText,
  lateralityCommitFromRail,
  lateralityControlDisabled,
  lateralityGradeLabelKey,
  lateralityNextFromControlInput,
  lateralityStepFromX,
  parseLateralityParam,
  resolveInitialLaterality,
  shouldPersistLaterality,
  shouldPersistLateralityAfterSwap,
  stepLaterality,
  type LateralityGrade,
} from './laterality.ts';
import { buildRelationshipsRequestBody } from './testQueryParams.ts';

function item(concept: string): DeckConcept {
  return {
    concept,
    shortDescription: `${concept} desc`,
    wikiUrl: null,
    mediaUrl: null,
  };
}

describe('parseLateralityParam', () => {
  it('accepts integer laterality 1–5', () => {
    assert.equal(parseLateralityParam('1'), 1);
    assert.equal(parseLateralityParam('4'), 4);
    assert.equal(parseLateralityParam('5'), 5);
    assert.equal(parseLateralityParam(' 3 '), 3);
  });

  it('ignores blank, non-integer, and out-of-range values', () => {
    assert.equal(parseLateralityParam(null), undefined);
    assert.equal(parseLateralityParam(undefined), undefined);
    assert.equal(parseLateralityParam(''), undefined);
    assert.equal(parseLateralityParam('   '), undefined);
    assert.equal(parseLateralityParam('abc'), undefined);
    assert.equal(parseLateralityParam('0'), undefined);
    assert.equal(parseLateralityParam('6'), undefined);
    assert.equal(parseLateralityParam('4.5'), undefined);
    assert.equal(parseLateralityParam('15'), undefined);
    assert.equal(parseLateralityParam('4abc'), undefined);
  });
});

describe('session-only URL laterality', () => {
  it('lets ?laterality=N win for this load without asking to persist', () => {
    assert.equal(resolveInitialLaterality(4, 2), 4);
    assert.equal(shouldPersistLaterality('hydrate'), false);
  });

  it('falls back to stored laterality when the URL param is absent', () => {
    assert.equal(resolveInitialLaterality(undefined, 2), 2);
  });

  it('persists only after an intentional control change', () => {
    assert.equal(shouldPersistLaterality('control'), true);
    assert.equal(shouldPersistLaterality('hydrate'), false);
  });

  it('persists a control swap only after the new tree lands', () => {
    assert.equal(shouldPersistLateralityAfterSwap('control', 'success'), true);
    assert.equal(shouldPersistLateralityAfterSwap('control', 'failure'), false);
    assert.equal(shouldPersistLateralityAfterSwap('hydrate', 'success'), false);
  });

  it('disables laterality control while a neighborhood swap is in flight', () => {
    assert.equal(lateralityControlDisabled(true, true), true);
    assert.equal(lateralityControlDisabled(true, false), false);
    assert.equal(lateralityControlDisabled(false, false), true);
    assert.equal(lateralityControlDisabled(false, true), true);
  });
});

describe('clampLaterality / stepLaterality', () => {
  it('defaults to the mid-scale grade', () => {
    assert.equal(DEFAULT_LATERALITY, 3);
    assert.equal(clampLaterality(Number.NaN), DEFAULT_LATERALITY);
  });

  it('clamps to 1–5 and steps without leaving the scale', () => {
    assert.equal(clampLaterality(0), 1);
    assert.equal(clampLaterality(9), 5);
    assert.equal(clampLaterality(2.6), 3);
    assert.equal(stepLaterality(1, -1), 1);
    assert.equal(stepLaterality(5, 1), 5);
    assert.equal(stepLaterality(3, 1), 4);
    assert.equal(stepLaterality(3, -1), 2);
  });
});

describe('grade labels and a11y value', () => {
  it('maps grades 1–5 onto lateralityGrade keys (all selectable)', () => {
    assert.deepEqual(LATERALITY_LABEL_KEYS, {
      1: 'lateralityGrade1',
      2: 'lateralityGrade2',
      3: 'lateralityGrade3',
      4: 'lateralityGrade4',
      5: 'lateralityGrade5',
    });
    for (const grade of [1, 2, 3, 4, 5] as const) {
      assert.equal(lateralityGradeLabelKey(grade), `lateralityGrade${grade}`);
      assert.equal(clampLaterality(grade), grade);
    }
  });

  it('builds a11y text as "<label>, n of 5" in en and es', () => {
    setActiveLocale('en');
    assert.equal(lateralityA11yText(4), 'Provocation, 4 of 5');
    assert.equal(t(lateralityGradeLabelKey(1)), 'Same domain');
    assert.equal(t(lateralityGradeLabelKey(5)), 'Random entry');

    setActiveLocale('es');
    assert.equal(lateralityA11yText(4), 'Provocación, 4 de 5');
    assert.equal(t(lateralityGradeLabelKey(2)), 'Contexto compartido');
    setActiveLocale('en');
  });

  it('fits the Spanish label composition at 320-wide character budget', () => {
    setActiveLocale('es');
    const label = `${t('laterality')} · ${t('lateralityGrade2')}`;
    assert.equal(label, 'Lateralidad · Contexto compartido');
    // 14px label on 320 − 32 gutter ≈ 288px; ~8px/glyph → ~36 glyphs.
    assert.ok(label.length <= 36, `label too long for 320: ${label.length}`);
    setActiveLocale('en');
  });
});

describe('lateralityStepFromX / lateralityCommitFromRail', () => {
  it('maps x across a rail width onto grades 1–5', () => {
    const width = 200;
    assert.equal(lateralityStepFromX(0, width), 1);
    assert.equal(lateralityStepFromX(39, width), 1);
    assert.equal(lateralityStepFromX(40, width), 2);
    assert.equal(lateralityStepFromX(100, width), 3);
    assert.equal(lateralityStepFromX(159, width), 4);
    assert.equal(lateralityStepFromX(160, width), 5);
    assert.equal(lateralityStepFromX(199, width), 5);
    assert.equal(lateralityStepFromX(200, width), 5);
  });

  it('falls back safely for empty width or non-finite x', () => {
    assert.equal(lateralityStepFromX(10, 0), DEFAULT_LATERALITY);
    assert.equal(lateralityStepFromX(Number.NaN, 100), DEFAULT_LATERALITY);
  });

  it('commits the rail-mapped grade unless a swap is in flight', () => {
    const width = 200;
    assert.equal(lateralityCommitFromRail(180, width), 5);
    assert.equal(lateralityCommitFromRail(0, width), 1);
    assert.equal(lateralityCommitFromRail(100, width, { swapping: false }), 3);
    assert.equal(lateralityCommitFromRail(180, width, { swapping: true }), null);
    // Mutating commit to ignore x (always current grade) would fail this:
    assert.notEqual(lateralityCommitFromRail(180, width), 1);
  });
});

describe('lateralityNextFromControlInput', () => {
  it('steps from increment/decrement actions and arrow keys', () => {
    assert.equal(lateralityNextFromControlInput(3, 'increment'), 4);
    assert.equal(lateralityNextFromControlInput(3, 'decrement'), 2);
    assert.equal(lateralityNextFromControlInput(3, 'ArrowRight'), 4);
    assert.equal(lateralityNextFromControlInput(3, 'ArrowLeft'), 2);
    assert.equal(lateralityNextFromControlInput(3, 'ArrowUp'), 4);
    assert.equal(lateralityNextFromControlInput(3, 'ArrowDown'), 2);
  });

  it('returns null at clamps, when swapping, or for unknown actions', () => {
    assert.equal(lateralityNextFromControlInput(1, 'decrement'), null);
    assert.equal(lateralityNextFromControlInput(5, 'increment'), null);
    assert.equal(lateralityNextFromControlInput(3, 'increment', { swapping: true }), null);
    assert.equal(lateralityNextFromControlInput(3, 'decrementX'), null);
    assert.equal(lateralityNextFromControlInput(3, 'Enter'), null);
  });

  it('requires the real increment action name (mutation guard)', () => {
    assert.equal(lateralityNextFromControlInput(2, 'increment'), 3);
    assert.equal(lateralityNextFromControlInput(2, 'decrementX'), null);
  });
});

describe('selecting each grade sends 1..5 to the API body', () => {
  it('includes laterality 1–5 in buildRelationshipsRequestBody', () => {
    for (const grade of [1, 2, 3, 4, 5] as LateralityGrade[]) {
      const body = buildRelationshipsRequestBody({ laterality: grade, locale: 'en' });
      assert.equal(body.laterality, grade);
    }
  });
});

describe('applyLateralityTreeSwap', () => {
  it('keeps the visible card and replaces the rest of the deck', () => {
    const existing = [item('mushroom'), item('tide'), item('lighthouse')];
    const incoming = [item('mushroom'), item('chaos'), item('entropy')];
    const swap = applyLateralityTreeSwap(existing, incoming, 0);
    assert.deepEqual(
      swap.concepts.map((c) => c.concept),
      ['mushroom', 'chaos', 'entropy'],
    );
    assert.equal(swap.currentIndex, 0);
  });

  it('keeps a mid-deck card on screen when the new tree arrives', () => {
    const existing = [item('mushroom'), item('tide'), item('lighthouse')];
    const incoming = [item('tide'), item('chaos'), item('entropy')];
    const swap = applyLateralityTreeSwap(existing, incoming, 1);
    assert.equal(swap.concepts[0]?.concept, 'tide');
    assert.deepEqual(
      swap.concepts.map((c) => c.concept),
      ['tide', 'chaos', 'entropy'],
    );
    assert.equal(swap.currentIndex, 0);
  });

  it('does not yank the current card when it is missing from the new tree', () => {
    const existing = [item('mushroom'), item('tide')];
    const incoming = [item('chaos'), item('entropy')];
    const swap = applyLateralityTreeSwap(existing, incoming, 0);
    assert.deepEqual(
      swap.concepts.map((c) => c.concept),
      ['mushroom', 'chaos', 'entropy'],
    );
  });

  it('leaves the deck alone when the prefetch is empty', () => {
    const existing = [item('mushroom')];
    const swap = applyLateralityTreeSwap(existing, [], 0);
    assert.deepEqual(swap.concepts, existing);
    assert.equal(swap.currentIndex, 0);
  });
});
