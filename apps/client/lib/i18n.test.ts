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
    assert.equal(t('tapToFlip'), 'Tap to flip');
    setActiveLocale('es');
    assert.equal(t('tapToFlip'), 'Toca para voltear');
    assert.equal(t('illustrationFor', { concept: 'silencio' }), 'Ilustración de silencio');
  });

  it('normalizes BCP-47 tags onto supported locales', () => {
    assert.equal(normalizeLocaleTag('es-ES'), 'es');
    assert.equal(normalizeLocaleTag('en_US'), 'en');
    assert.equal(normalizeLocaleTag('fr-FR'), null);
  });
});

describe('resolveLocalePreference', () => {
  it('prefers URL locale over device locale', () => {
    assert.equal(
      resolveLocalePreference({ urlLocale: 'es', deviceLocale: 'en-US' }),
      'es',
    );
  });

  it('falls back to device then default', () => {
    assert.equal(resolveLocalePreference({ urlLocale: null, deviceLocale: 'es-MX' }), 'es');
    assert.equal(resolveLocalePreference({ urlLocale: null, deviceLocale: 'de-DE' }), DEFAULT_LOCALE);
  });

  it('ignores unsupported URL locale and uses device', () => {
    assert.equal(resolveLocalePreference({ urlLocale: 'fr', deviceLocale: 'es' }), 'es');
  });
});

describe('getActiveLocale default', () => {
  it('starts at en unless set', () => {
    setActiveLocale('en');
    assert.equal(getActiveLocale(), 'en');
  });
});
