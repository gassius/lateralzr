import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { aboutViewContent } from './aboutView.ts';
import { expoVersionFromAppJson, readAppVersion } from './appVersion.ts';
import { setActiveLocale, t } from './i18n.ts';

const appJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'app.json');

describe('aboutViewContent', () => {
  it('exposes the on-paper logo name, en/es promise, and app.json version', () => {
    const expectedVersion = (
      JSON.parse(readFileSync(appJsonPath, 'utf8')) as { expo: { version: string } }
    ).expo.version;

    setActiveLocale('en');
    const en = aboutViewContent(t, readAppVersion());
    assert.equal(en.logoLabel, 'Lateralzr');
    assert.equal(en.logoOpacity, 1);
    assert.equal(en.promise, 'A little space to think differently.');
    assert.notEqual(en.promise, t('menuAbout'));
    assert.equal(en.version, expectedVersion);
    assert.equal(en.version, expoVersionFromAppJson());

    setActiveLocale('es');
    const es = aboutViewContent(t, readAppVersion());
    assert.equal(es.logoLabel, 'Lateralzr');
    assert.equal(es.promise, 'Un poco de espacio para pensar distinto.');
    assert.notEqual(es.promise, t('menuAbout'));
    assert.equal(es.version, expectedVersion);

    setActiveLocale('en');
  });
});
