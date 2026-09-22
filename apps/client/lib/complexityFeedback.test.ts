import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Palette } from '../constants/Colors.ts';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign.ts';
import {
  COMPLEXITY_CUE_DURATION_MS,
  COMPLEXITY_CUE_SESSION_DURATION_MS,
  COMPLEXITY_CUE_FONT_SIZE,
  COMPLEXITY_CUE_PLACEMENT,
  complexityCueAppearOpacity,
  complexityCueAppearTranslateY,
  complexityCueContrastRatio,
  complexityCueHoldMs,
  complexityCueIsSecondaryToConceptTitle,
  complexityCueLabel,
  complexityCuePalette,
  complexityCueSharesLateralityRow,
  shouldAnimateComplexityCue,
  shouldAnnounceComplexity,
} from './complexityFeedback.ts';
import { setActiveLocale, t } from './i18n.ts';
import { shouldPersistComplexity } from './testQueryParams.ts';

describe('shouldAnnounceComplexity', () => {
  it('announces a session deep-link complexity so the rung is visible without the URL', () => {
    assert.equal(shouldAnnounceComplexity({ reason: 'session-url', complexity: 5 }), true);
    assert.equal(shouldAnnounceComplexity({ reason: 'session-url', complexity: 1 }), true);
  });

  it('announces an in-session complexity change from a vertical swipe', () => {
    assert.equal(
      shouldAnnounceComplexity({ reason: 'swipe', previous: 2, next: 3 }),
      true,
    );
    assert.equal(
      shouldAnnounceComplexity({ reason: 'swipe', previous: 5, next: 4 }),
      true,
    );
  });

  it('stays quiet when a swipe is clamped and the rung does not change', () => {
    assert.equal(
      shouldAnnounceComplexity({ reason: 'swipe', previous: 5, next: 5 }),
      false,
    );
    assert.equal(
      shouldAnnounceComplexity({ reason: 'swipe', previous: 1, next: 1 }),
      false,
    );
  });

  it('does not announce a stored-pref hydrate with no session complexity param', () => {
    assert.equal(shouldAnnounceComplexity({ reason: 'hydrate-stored', complexity: 5 }), false);
    assert.equal(shouldAnnounceComplexity({ reason: 'hydrate-stored', complexity: 2 }), false);
  });

  it('does not treat announcing a session URL as a reason to persist prefs', () => {
    assert.equal(shouldAnnounceComplexity({ reason: 'session-url', complexity: 5 }), true);
    assert.equal(shouldPersistComplexity('hydrate'), false);
  });
});

describe('complexity cue copy', () => {
  it('names the dimension Complexity, not Laterality, and includes the rung', () => {
    assert.equal(complexityCueLabel(5, 'en'), 'Complexity 5');
    assert.equal(complexityCueLabel(1, 'en'), 'Complexity 1');
    assert.match(complexityCueLabel(5, 'es'), /complejidad 5/i);
    assert.doesNotMatch(complexityCueLabel(5, 'en'), /laterality/i);
    assert.doesNotMatch(complexityCueLabel(5, 'es'), /lateralidad/i);
  });

  it('keeps i18n catalogs aligned with the cue label', () => {
    setActiveLocale('en');
    assert.equal(t('complexityGrade', { grade: '5' }), complexityCueLabel(5, 'en'));
    setActiveLocale('es');
    assert.equal(t('complexityGrade', { grade: '5' }), complexityCueLabel(5, 'es'));
    setActiveLocale('en');
  });
});

describe('complexity cue placement and hierarchy', () => {
  it('lives on the letterbox overlay, not the laterality − / wordmark / + row', () => {
    assert.equal(COMPLEXITY_CUE_PLACEMENT, 'letterbox-overlay');
    assert.equal(complexityCueSharesLateralityRow(), false);
  });

  it('stays secondary to the concept title and quieter than swipe/flip coaching', () => {
    assert.ok(complexityCueIsSecondaryToConceptTitle());
    assert.ok(COMPLEXITY_CUE_FONT_SIZE < CONCEPT_FRONT_LABEL_FONT_SIZE);
    assert.ok(COMPLEXITY_CUE_FONT_SIZE < 17);
  });
});

describe('complexity cue contrast', () => {
  it('meets WCAG AA contrast on the off-white chip over the teal letterbox', () => {
    const palette = complexityCuePalette();
    assert.equal(palette.text, Palette.darkBlue);
    assert.equal(palette.chip, Palette.offWhite);
    assert.equal(palette.backdrop, Palette.darkBlue);
    assert.ok(complexityCueContrastRatio() >= 4.5);
  });
});

describe('complexity cue motion', () => {
  it('is a short-lived fade that is skipped entirely when reduced motion is requested', () => {
    assert.ok(COMPLEXITY_CUE_DURATION_MS <= 2200);
    assert.ok(COMPLEXITY_CUE_DURATION_MS >= 1200);
    assert.ok(COMPLEXITY_CUE_SESSION_DURATION_MS >= COMPLEXITY_CUE_DURATION_MS);
    assert.ok(COMPLEXITY_CUE_SESSION_DURATION_MS <= 5000);
    assert.equal(complexityCueHoldMs('session-url'), COMPLEXITY_CUE_SESSION_DURATION_MS);
    assert.equal(complexityCueHoldMs('swipe'), COMPLEXITY_CUE_DURATION_MS);
    assert.equal(shouldAnimateComplexityCue(false), true);
    assert.equal(shouldAnimateComplexityCue(true), false);
    assert.equal(complexityCueAppearOpacity(true, 0), 1);
    assert.equal(complexityCueAppearTranslateY(true, 0), 0);
    assert.equal(complexityCueAppearOpacity(false, 0), 0);
    assert.equal(complexityCueAppearTranslateY(false, 0), 6);
    assert.equal(complexityCueAppearOpacity(false, 1), 1);
    assert.equal(complexityCueAppearTranslateY(false, 1), 0);
  });
});
