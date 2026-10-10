import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  DEFAULT_LOCALE,
  getActiveLocale,
  MESSAGE_KEYS,
  messages,
  normalizeLocaleTag,
  resolveLocalePreference,
  setActiveLocale,
  t,
} from '../lib/i18n.ts';

function placeholderNames(text: string): string[] {
  return [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]!).sort();
}

afterEach(() => {
  setActiveLocale(DEFAULT_LOCALE);
});

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

  it('keeps en and es catalogs aligned with MESSAGE_KEYS (no t() fallback)', () => {
    const expected = [...MESSAGE_KEYS].sort();
    assert.deepEqual(Object.keys(messages.en).sort(), expected);
    assert.deepEqual(Object.keys(messages.es).sort(), expected);

    for (const key of MESSAGE_KEYS) {
      const en = messages.en[key];
      const es = messages.es[key];
      assert.equal(typeof en, 'string', `en.${key} should be a string`);
      assert.equal(typeof es, 'string', `es.${key} should be a string`);
      assert.ok(en.trim().length > 0, `expected non-empty en for ${key}`);
      assert.ok(es.trim().length > 0, `expected non-empty es for ${key}`);
      assert.deepEqual(
        placeholderNames(en),
        placeholderNames(es),
        `placeholder set mismatch for ${key}`,
      );
    }
  });

  it('uses the approved v3.3 noDescription copy', () => {
    setActiveLocale('en');
    assert.equal(t('noDescription'), "There isn't a description for this concept yet.");
    setActiveLocale('es');
    assert.equal(t('noDescription'), 'Este concepto aún no tiene descripción.');
  });

  it('exposes approved laterality grade labels', () => {
    setActiveLocale('en');
    assert.equal(t('lateralityGrade1'), 'Same domain');
    assert.equal(t('lateralityGrade5'), 'Random entry');
    assert.equal(t('lateralityA11yValue', { label: 'Provocation', n: '4' }), 'Provocation, 4 of 5');
    setActiveLocale('es');
    assert.equal(t('lateralityGrade1'), 'Mismo dominio');
    assert.equal(t('lateralityGrade5'), 'Entrada aleatoria');
    assert.equal(t('lateralityA11yValue', { label: 'Provocación', n: '4' }), 'Provocación, 4 de 5');
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

describe('shell / menu labels (Lz-21)', () => {
  it('provides openMenu and webTitle in en and es', () => {
    setActiveLocale('en');
    assert.equal(t('openMenu'), 'Open menu');
    assert.equal(t('webTitle'), 'Lateralzr');
    setActiveLocale('es');
    assert.equal(t('openMenu'), 'Abrir menú');
    assert.equal(t('webTitle'), 'Lateralzr');
  });
});

describe('laterality accessible names', () => {
  it('keeps English laterality names in en', () => {
    setActiveLocale('en');
    assert.equal(t('decreaseLaterality'), 'Decrease laterality');
    assert.equal(t('increaseLaterality'), 'Increase laterality');
    assert.equal(t('laterality'), 'Laterality');
  });

  it('uses fully Spanish laterality names in es', () => {
    setActiveLocale('es');
    assert.equal(t('decreaseLaterality'), 'Disminuir lateralidad');
    assert.equal(t('increaseLaterality'), 'Aumentar lateralidad');
    assert.equal(t('laterality'), 'Lateralidad');

    for (const key of ['decreaseLaterality', 'increaseLaterality', 'laterality'] as const) {
      assert.match(t(key), /lateralidad/i);
      assert.doesNotMatch(t(key), /\blaterality\b/i);
    }
  });

  it('announces laterality neighborhood loading without mixed English in es', () => {
    setActiveLocale('en');
    assert.equal(t('loadingLateralNeighborhood'), 'Loading a new neighborhood');
    setActiveLocale('es');
    assert.equal(t('loadingLateralNeighborhood'), 'Cargando un vecindario nuevo');
    assert.doesNotMatch(t('loadingLateralNeighborhood'), /\blaterality\b/i);
  });
});
