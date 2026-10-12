import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { getActiveLocale, setActiveLocale, t } from './i18n.ts';
import {
  loadStoredLocale,
  persistLocale,
  selectLocale,
  useLocaleStorageDriver,
} from './localeStorage.ts';

const LOCALE_KEY = 'lateralzr.appLocale';

function memoryDriver() {
  const mem = new Map<string, string>();
  return {
    mem,
    driver: {
      async getItem(key: string): Promise<string | null> {
        return mem.has(key) ? mem.get(key)! : null;
      },
      async setItem(key: string, value: string): Promise<void> {
        mem.set(key, value);
      },
    },
  };
}

describe('localeStorage', () => {
  let store: ReturnType<typeof memoryDriver>;

  beforeEach(() => {
    store = memoryDriver();
    useLocaleStorageDriver(store.driver);
    setActiveLocale('en');
  });

  afterEach(() => {
    useLocaleStorageDriver(null);
    setActiveLocale('en');
  });

  it('persistLocale writes es and loadStoredLocale returns it', async () => {
    await persistLocale('es');
    assert.equal(store.mem.get(LOCALE_KEY), 'es');
    assert.equal(await loadStoredLocale(), 'es');
  });

  it('loadStoredLocale returns null for blank or unsupported stored values', async () => {
    store.mem.set(LOCALE_KEY, 'fr');
    assert.equal(await loadStoredLocale(), null);
    store.mem.set(LOCALE_KEY, '  ');
    assert.equal(await loadStoredLocale(), null);
    store.mem.delete(LOCALE_KEY);
    assert.equal(await loadStoredLocale(), null);
  });

  it('selectLocale applies the pick and persists it (fails if either is skipped)', async () => {
    selectLocale('es', { setActive: setActiveLocale, persist: persistLocale });
    await Promise.resolve();

    assert.equal(getActiveLocale(), 'es');
    assert.equal(t('menuLanguage'), 'Idioma');
    assert.equal(store.mem.get(LOCALE_KEY), 'es');
    assert.equal(await loadStoredLocale(), 'es');
  });
});
