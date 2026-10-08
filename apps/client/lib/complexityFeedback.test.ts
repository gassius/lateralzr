import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Palette } from '../constants/Colors.ts';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign.ts';
import {
  COMPLEXITY_CUE_APPEAR_TRANSLATE_Y,
  COMPLEXITY_CUE_DURATION_MS,
  COMPLEXITY_CUE_SESSION_DURATION_MS,
  COMPLEXITY_CUE_FONT_SIZE,
  COMPLEXITY_CUE_PLACEMENT,
  COMPLEXITY_SESSION_MARK_FONT_SIZE,
  complexityCueContrastRatio,
  complexityCueHoldMs,
  complexityCueIsSecondaryToConceptTitle,
  complexityCuePalette,
  complexityCueText,
  resolveSessionComplexityToAnnounce,
  shouldAnimateComplexityCue,
  shouldAnnounceComplexity,
  shouldKeepSessionComplexityMark,
} from './complexityFeedback.ts';
import { DEFAULT_LOCALE, setActiveLocale, t } from './i18n.ts';
import { shouldPersistComplexity } from './testQueryParams.ts';

afterEach(() => {
  setActiveLocale(DEFAULT_LOCALE);
});

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

describe('resolveSessionComplexityToAnnounce', () => {
  it('waits when the deck is up but hydrate has not queued a session grade yet', () => {
    assert.equal(
      resolveSessionComplexityToAnnounce({
        alreadyAnnounced: false,
        pending: null,
        routeComplexity: undefined,
        rememberedComplexity: undefined,
      }),
      undefined,
    );
  });

  it('still announces when the pending session grade arrives after the deck is already visible', () => {
    assert.equal(
      resolveSessionComplexityToAnnounce({
        alreadyAnnounced: false,
        pending: 5,
        routeComplexity: undefined,
        rememberedComplexity: undefined,
      }),
      5,
    );
  });

  it('uses the live route param when hydrate has not queued yet', () => {
    assert.equal(
      resolveSessionComplexityToAnnounce({
        alreadyAnnounced: false,
        pending: null,
        routeComplexity: 5,
        rememberedComplexity: 2,
      }),
      5,
    );
  });

  it('does not announce a second time after the session cue already flushed', () => {
    assert.equal(
      resolveSessionComplexityToAnnounce({
        alreadyAnnounced: true,
        pending: 5,
        routeComplexity: 5,
        rememberedComplexity: 5,
      }),
      undefined,
    );
  });
});

describe('complexity cue copy', () => {
  it('names the dimension Complexity, not Laterality, and includes the rung', () => {
    setActiveLocale('en');
    assert.equal(t('complexityGrade', { grade: '5' }), 'Complexity 5');
    assert.equal(t('complexityGrade', { grade: '1' }), 'Complexity 1');
    assert.doesNotMatch(t('complexityGrade', { grade: '5' }), /laterality/i);
    setActiveLocale('es');
    assert.match(t('complexityGrade', { grade: '5' }), /complejidad 5/i);
    assert.doesNotMatch(t('complexityGrade', { grade: '5' }), /lateralidad/i);
  });

  it('renders cue copy from the active i18n catalog', () => {
    setActiveLocale('en');
    assert.equal(complexityCueText(5), t('complexityGrade', { grade: '5' }));
    setActiveLocale('es');
    assert.equal(complexityCueText(5), t('complexityGrade', { grade: '5' }));
  });
});

describe('complexity cue placement and hierarchy', () => {
  it('lives on the letterbox overlay, not the laterality − / wordmark / + row', () => {
    assert.equal(COMPLEXITY_CUE_PLACEMENT, 'letterbox-overlay');
  });

  it('stays secondary to the concept title and quieter than swipe/flip coaching', () => {
    assert.ok(complexityCueIsSecondaryToConceptTitle());
    assert.ok(COMPLEXITY_CUE_FONT_SIZE < CONCEPT_FRONT_LABEL_FONT_SIZE);
    assert.ok(COMPLEXITY_CUE_FONT_SIZE < 17);
  });

  it('keeps a quieter session mark after a deep link, not after stored-pref hydrate', () => {
    assert.equal(shouldKeepSessionComplexityMark('session-url'), true);
    assert.equal(shouldKeepSessionComplexityMark('hydrate-stored'), false);
    assert.equal(shouldKeepSessionComplexityMark('swipe'), false);
    assert.ok(COMPLEXITY_SESSION_MARK_FONT_SIZE < COMPLEXITY_CUE_FONT_SIZE);
    assert.ok(complexityCueIsSecondaryToConceptTitle(COMPLEXITY_SESSION_MARK_FONT_SIZE));
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
    assert.equal(COMPLEXITY_CUE_APPEAR_TRANSLATE_Y, 6);
  });
});
