import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { color } from '../theme/tokens.ts';
import { CONCEPT_FRONT_TITLE_FONT_SIZE } from './conceptFrontTitle.ts';
import {
  blendHexOver,
  coachHintContrastRatio,
  coachHintIsSecondaryToConceptTitle,
  contrastRatio,
  COACH_APPEAR_DURATION_MS,
  COACH_APPEAR_TRANSLATE_Y,
  COACH_HINT_FONT_SIZE,
  COACH_HINT_FONT_WEIGHT,
  COACH_HINT_OPACITY,
  coachHintPalette,
} from './coachHintPresentation.ts';

describe('coach hint type hierarchy', () => {
  it('is larger than the previous 12px overlay and still smaller than the concept title', () => {
    assert.ok(COACH_HINT_FONT_SIZE > 12);
    assert.equal(COACH_HINT_FONT_SIZE, 17);
    assert.equal(COACH_HINT_FONT_WEIGHT, '500');
    assert.equal(COACH_HINT_OPACITY, 1);
    assert.ok(coachHintIsSecondaryToConceptTitle());
    assert.ok(COACH_HINT_FONT_SIZE < CONCEPT_FRONT_TITLE_FONT_SIZE);
  });
});

describe('coach hint contrast', () => {
  it('meets WCAG AA normal-text contrast on the orange card chip', () => {
    const orange = coachHintPalette('orange');
    assert.equal(orange.text, color.concept);
    assert.equal(orange.chip, color.paper);
    assert.ok(coachHintContrastRatio('orange') >= 4.5);
  });

  it('meets WCAG AA contrast if the coach sits on teal without a chip', () => {
    const teal = coachHintPalette('teal');
    assert.equal(teal.text, color.paper);
    assert.equal(teal.chip, 'transparent');
    assert.ok(coachHintContrastRatio('teal') >= 4.5);
  });

  it('is a clear upgrade over 12px dark-blue at 75% opacity on orange', () => {
    const washed = blendHexOver(color.concept, 0.75, color.front);
    const legacyRatio = contrastRatio(washed, color.front);
    assert.ok(legacyRatio < 4.5);
    assert.ok(coachHintContrastRatio('orange') > legacyRatio);
  });
});

describe('coach appear motion', () => {
  it('is a short fade/slide whose tokens stay locked', () => {
    assert.ok(COACH_APPEAR_DURATION_MS <= 400);
    assert.equal(COACH_APPEAR_TRANSLATE_Y, 8);
  });
});
