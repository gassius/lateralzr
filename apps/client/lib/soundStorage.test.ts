import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { t } from './i18n.ts';
import {
  DEFAULT_SOUND_PREFERENCES,
  loadStoredSound,
  parseSoundPreferences,
  persistSound,
  SOUND_PREFERENCES_STORAGE_KEY,
  soundPreferenceSummaryKey,
  useSoundStorageDriver,
  type SoundPreferences,
} from './soundStorage.ts';

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

describe('soundStorage pure helpers', () => {
  it('parseSoundPreferences returns defaults for null, blank, or bad JSON', () => {
    assert.deepEqual(parseSoundPreferences(null), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences(undefined), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences(''), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences('  '), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences('not-json'), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences('[]'), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences('null'), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences('"yes"'), DEFAULT_SOUND_PREFERENCES);
  });

  it('parseSoundPreferences fills missing or non-boolean fields from defaults', () => {
    assert.deepEqual(parseSoundPreferences('{}'), DEFAULT_SOUND_PREFERENCES);
    assert.deepEqual(parseSoundPreferences('{"sound":false}'), {
      sound: false,
      music: true,
      effects: true,
    });
    assert.deepEqual(parseSoundPreferences('{"sound":0,"music":false,"effects":"no"}'), {
      sound: true,
      music: false,
      effects: true,
    });
    assert.deepEqual(
      parseSoundPreferences('{"sound":false,"music":false,"effects":false}'),
      { sound: false, music: false, effects: false },
    );
  });

  it('soundPreferenceSummaryKey maps audible state to i18n keys', () => {
    const cases: Array<[SoundPreferences, string]> = [
      [{ sound: false, music: true, effects: true }, 'soundSummaryOff'],
      [{ sound: true, music: true, effects: true }, 'soundSummaryOn'],
      [{ sound: true, music: true, effects: false }, 'soundSummaryMusicOnly'],
      [{ sound: true, music: false, effects: true }, 'soundSummaryEffectsOnly'],
      [{ sound: true, music: false, effects: false }, 'soundSummaryOff'],
    ];
    for (const [prefs, key] of cases) {
      assert.equal(soundPreferenceSummaryKey(prefs), key);
    }
    assert.equal(t(soundPreferenceSummaryKey(DEFAULT_SOUND_PREFERENCES)), 'On');
    assert.equal(
      t(soundPreferenceSummaryKey({ sound: false, music: true, effects: true })),
      'Off',
    );
  });
});

describe('soundStorage load / persist', () => {
  let store: ReturnType<typeof memoryDriver>;

  beforeEach(() => {
    store = memoryDriver();
    useSoundStorageDriver(store.driver);
  });

  afterEach(() => {
    useSoundStorageDriver(null);
  });

  it('persistSound writes JSON and loadStoredSound returns it', async () => {
    const prefs: SoundPreferences = { sound: true, music: false, effects: true };
    await persistSound(prefs);
    assert.equal(store.mem.get(SOUND_PREFERENCES_STORAGE_KEY), JSON.stringify(prefs));
    assert.deepEqual(await loadStoredSound(), prefs);
  });

  it('loadStoredSound returns defaults for blank or unknown values', async () => {
    store.mem.set(SOUND_PREFERENCES_STORAGE_KEY, 'nope');
    assert.deepEqual(await loadStoredSound(), DEFAULT_SOUND_PREFERENCES);
    store.mem.set(SOUND_PREFERENCES_STORAGE_KEY, '  ');
    assert.deepEqual(await loadStoredSound(), DEFAULT_SOUND_PREFERENCES);
    store.mem.delete(SOUND_PREFERENCES_STORAGE_KEY);
    assert.deepEqual(await loadStoredSound(), DEFAULT_SOUND_PREFERENCES);
  });

  it('persistSound coerces non-boolean fields to defaults', async () => {
    await persistSound({ sound: true, music: 'x' as unknown as boolean, effects: false });
    assert.equal(
      store.mem.get(SOUND_PREFERENCES_STORAGE_KEY),
      JSON.stringify({ sound: true, music: true, effects: false }),
    );
  });
});
