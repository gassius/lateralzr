import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Palette } from '../constants/Colors.ts';
import { contrastRatio } from './coachHintPresentation.ts';
import type { DeckConcept } from './conceptDeck.ts';
import {
  applyLateralityTreeSwap,
  clampLaterality,
  DEFAULT_LATERALITY,
  lateralityGradientStops,
  parseLateralityParam,
  resolveHydratedLaterality,
  resolveInitialLaterality,
  lateralityControlDisabled,
  restoreLateralityAfterFailedSwap,
  shouldPersistLaterality,
  shouldPersistLateralityAfterSwap,
  stepLaterality,
} from './laterality.ts';

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
    const hydrated = resolveHydratedLaterality(4, 2);
    assert.equal(hydrated.laterality, 4);
    assert.equal(hydrated.persist, false);
    assert.equal(resolveInitialLaterality(4, 2), 4);
    assert.equal(shouldPersistLaterality('hydrate'), false);
  });

  it('falls back to stored laterality when the URL param is absent', () => {
    assert.deepEqual(resolveHydratedLaterality(undefined, 2), {
      laterality: 2,
      persist: false,
    });
    assert.equal(resolveInitialLaterality(undefined, 2), 2);
  });

  it('persists only after an intentional submenu control', () => {
    assert.equal(shouldPersistLaterality('control'), true);
    assert.equal(shouldPersistLaterality('hydrate'), false);
  });

  it('persists a control swap only after the new tree lands', () => {
    assert.equal(shouldPersistLateralityAfterSwap('control', 'success'), true);
    assert.equal(shouldPersistLateralityAfterSwap('control', 'failure'), false);
    assert.equal(shouldPersistLateralityAfterSwap('hydrate', 'success'), false);
  });

  it('restores the last confirmed grade when the laterality fetch fails', () => {
    assert.equal(restoreLateralityAfterFailedSwap(3), 3);
    assert.equal(restoreLateralityAfterFailedSwap(1), 1);
  });

  it('disables laterality ± while a neighborhood swap is in flight', () => {
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

describe('lateralityGradientStops', () => {
  it('uses a cool, contained pair at laterality 1 (not deck teal)', () => {
    const stops = lateralityGradientStops(1);
    assert.notEqual(stops.start, Palette.darkBlue);
    assert.notEqual(stops.end, Palette.darkBlue);
    assert.notEqual(stops.start, stops.end);
  });

  it('bridges a light cool stop to brand orange at the default grade', () => {
    assert.deepEqual(lateralityGradientStops(3), {
      start: Palette.offWhite,
      end: Palette.orange,
    });
  });

  it('opens toward orange / off-white at laterality 5', () => {
    assert.deepEqual(lateralityGradientStops(5), {
      start: Palette.orange,
      end: Palette.offWhite,
    });
  });

  it('keeps every grade readable on the dark-blue deck', () => {
    for (const grade of [1, 2, 3, 4, 5] as const) {
      const stops = lateralityGradientStops(grade);
      for (const color of [stops.start, stops.mid, stops.end]) {
        if (!color) continue;
        assert.ok(
          contrastRatio(color, Palette.darkBlue) >= 3,
          `grade ${grade} ${color} contrast vs deck`,
        );
      }
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
