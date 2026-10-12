import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { t } from './i18n.ts';
import {
  DEFAULT_MOTION_PREFERENCE,
  isMotionPreference,
  loadStoredMotionPreference,
  motionPreferenceLabelKey,
  MOTION_PREFERENCE_OPTIONS,
  parseMotionPreference,
  persistMotionPreference,
  useMotionStorageDriver,
  type MotionPreference,
} from './motionStorage.ts';

const STORAGE_KEY = 'lateralzr.motionPreference';

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

describe('motionStorage pure helpers', () => {
  it('isMotionPreference accepts only system / reduced / full', () => {
    assert.equal(isMotionPreference('system'), true);
    assert.equal(isMotionPreference('reduced'), true);
    assert.equal(isMotionPreference('full'), true);
    assert.equal(isMotionPreference('System'), false);
    assert.equal(isMotionPreference(''), false);
    assert.equal(isMotionPreference('off'), false);
  });

  it('parseMotionPreference trims, lowercases, and falls back to System', () => {
    assert.equal(parseMotionPreference(null), DEFAULT_MOTION_PREFERENCE);
    assert.equal(parseMotionPreference(undefined), DEFAULT_MOTION_PREFERENCE);
    assert.equal(parseMotionPreference(''), DEFAULT_MOTION_PREFERENCE);
    assert.equal(parseMotionPreference('  '), DEFAULT_MOTION_PREFERENCE);
    assert.equal(parseMotionPreference('unknown'), DEFAULT_MOTION_PREFERENCE);
    assert.equal(parseMotionPreference(' Reduced '), 'reduced');
    assert.equal(parseMotionPreference('FULL'), 'full');
    assert.equal(parseMotionPreference('system'), 'system');
  });

  it('motionPreferenceLabelKey maps each option to i18n keys', () => {
    const expected: Record<MotionPreference, string> = {
      system: 'motionSystem',
      reduced: 'motionReduced',
      full: 'motionFull',
    };
    for (const pref of MOTION_PREFERENCE_OPTIONS) {
      assert.equal(motionPreferenceLabelKey(pref), expected[pref]);
    }
    assert.equal(t(motionPreferenceLabelKey('system')), 'Follow system');
    assert.equal(t(motionPreferenceLabelKey('reduced')), 'Reduced');
  });
});

describe('motionStorage load / persist', () => {
  let store: ReturnType<typeof memoryDriver>;

  beforeEach(() => {
    store = memoryDriver();
    useMotionStorageDriver(store.driver);
  });

  afterEach(() => {
    useMotionStorageDriver(null);
  });

  it('persistMotionPreference writes and loadStoredMotionPreference returns it', async () => {
    await persistMotionPreference('reduced');
    assert.equal(store.mem.get(STORAGE_KEY), 'reduced');
    assert.equal(await loadStoredMotionPreference(), 'reduced');
  });

  it('loadStoredMotionPreference returns System for blank or unknown values', async () => {
    store.mem.set(STORAGE_KEY, 'nope');
    assert.equal(await loadStoredMotionPreference(), 'system');
    store.mem.set(STORAGE_KEY, '  ');
    assert.equal(await loadStoredMotionPreference(), 'system');
    store.mem.delete(STORAGE_KEY);
    assert.equal(await loadStoredMotionPreference(), 'system');
  });

  it('persistMotionPreference coerces unknown values to System', async () => {
    await persistMotionPreference('nope' as MotionPreference);
    assert.equal(store.mem.get(STORAGE_KEY), 'system');
  });
});
