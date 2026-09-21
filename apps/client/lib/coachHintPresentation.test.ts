import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Palette } from '../constants/Colors.ts';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign.ts';
import {
  blendHexOver,
  coachAppearOpacity,
  coachAppearTranslateY,
  coachHintContrastRatio,
  coachHintIsSecondaryToConceptTitle,
  contrastRatio,
  COACH_APPEAR_DURATION_MS,
  COACH_APPEAR_TRANSLATE_Y,
  COACH_HINT_FONT_SIZE,
  COACH_HINT_FONT_WEIGHT,
  COACH_HINT_OPACITY,
  coachHintPalette,
  shouldAnimateCoachAppear,
} from './coachHintPresentation.ts';

describe('coach hint type hierarchy', () => {
  it('is larger than the previous 12px overlay and still smaller than the concept title', () => {
    assert.ok(COACH_HINT_FONT_SIZE > 12);
    assert.equal(COACH_HINT_FONT_WEIGHT, '600');
    assert.equal(COACH_HINT_OPACITY, 1);
    assert.ok(coachHintIsSecondaryToConceptTitle());
    assert.ok(COACH_HINT_FONT_SIZE < CONCEPT_FRONT_LABEL_FONT_SIZE);
  });
});

describe('coach hint contrast', () => {
  it('meets WCAG AA normal-text contrast on the orange card chip', () => {
    const orange = coachHintPalette('orange');
    assert.equal(orange.text, Palette.darkBlue);
    assert.equal(orange.chip, Palette.offWhite);
    assert.ok(coachHintContrastRatio('orange') >= 4.5);
  });

  it('meets WCAG AA contrast if the coach sits on teal without a chip', () => {
    const teal = coachHintPalette('teal');
    assert.equal(teal.text, Palette.offWhite);
    assert.equal(teal.chip, 'transparent');
    assert.ok(coachHintContrastRatio('teal') >= 4.5);
  });

  it('is a clear upgrade over 12px dark-blue at 75% opacity on orange', () => {
    const washed = blendHexOver(Palette.darkBlue, 0.75, Palette.orange);
    const legacyRatio = contrastRatio(washed, Palette.orange);
    assert.ok(legacyRatio < 4.5);
    assert.ok(coachHintContrastRatio('orange') > legacyRatio);
  });
});

describe('coach appear motion', () => {
  it('is a short fade/slide, skipped entirely when reduced motion is requested', () => {
    assert.ok(COACH_APPEAR_DURATION_MS <= 400);
    assert.equal(shouldAnimateCoachAppear(false), true);
    assert.equal(shouldAnimateCoachAppear(true), false);
    assert.equal(coachAppearOpacity(true, 0), 1);
    assert.equal(coachAppearTranslateY(true, 0), 0);
    assert.equal(coachAppearOpacity(false, 0), 0);
    assert.equal(coachAppearTranslateY(false, 0), COACH_APPEAR_TRANSLATE_Y);
    assert.equal(coachAppearOpacity(false, 1), 1);
    assert.equal(coachAppearTranslateY(false, 1), 0);
  });
});
