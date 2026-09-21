import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LOCALE,
  getActiveLocale,
  normalizeLocaleTag,
  resolveLocalePreference,
  setActiveLocale,
  t,
} from '../lib/i18n.ts';

describe('i18n locale catalogs', () => {
  it('translates keys for en and es', () => {
    setActiveLocale('en');
    assert.equal(t('swipeCoach'), 'Swipe for another idea');
    assert.equal(t('flipCoach'), 'Tap the card to learn more');
    setActiveLocale('es');
    assert.equal(t('swipeCoach'), 'Desliza para otra idea');
    assert.equal(t('flipCoach'), 'Toca la tarjeta para saber más');
    assert.equal(t('illustrationFor', { concept: 'silencio' }), 'Ilustración de silencio');
  });

  it('normalizes BCP-47 tags onto supported locales', () => {
    assert.equal(normalizeLocaleTag('es-ES'), 'es');
    assert.equal(normalizeLocaleTag('en_US'), 'en');
    assert.equal(normalizeLocaleTag('fr-FR'), null);
  });
});

describe('resolveLocalePreference', () => {
  it('prefers URL locale over default', () => {
    assert.equal(resolveLocalePreference({ urlLocale: 'es' }), 'es');
    assert.equal(resolveLocalePreference({ urlLocale: 'en-US' }), 'en');
  });

  it('defaults to en when URL locale is missing or unsupported', () => {
    assert.equal(resolveLocalePreference({ urlLocale: null }), DEFAULT_LOCALE);
    assert.equal(resolveLocalePreference({}), DEFAULT_LOCALE);
    assert.equal(resolveLocalePreference({ urlLocale: 'fr' }), DEFAULT_LOCALE);
    assert.equal(resolveLocalePreference({ urlLocale: 'es-MX' }), 'es');
  });

  it('never uses device/browser locale as the default', () => {
    assert.equal(resolveLocalePreference({ urlLocale: null }), 'en');
    assert.equal(DEFAULT_LOCALE, 'en');
  });
});

describe('getActiveLocale default', () => {
  it('starts at en unless set', () => {
    setActiveLocale('en');
    assert.equal(getActiveLocale(), 'en');
  });
});
