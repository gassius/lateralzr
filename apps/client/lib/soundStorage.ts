import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MessageKey } from '@/lib/i18n';
import {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFERENCES_STORAGE_KEY,
  type SoundPreferences,
} from '@/lib/soundTypes';

export {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFERENCES_STORAGE_KEY,
  type SoundPreferences,
} from '@/lib/soundTypes';

type SoundStorageDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

let driver: SoundStorageDriver = AsyncStorage;

/** Tests inject an in-memory map so Node can run without `window`. */
export function useSoundStorageDriver(next: SoundStorageDriver | null): void {
  driver = next ?? AsyncStorage;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Parse stored / raw JSON; unknown or bad shape → defaults (all on). */
export function parseSoundPreferences(raw: string | null | undefined): SoundPreferences {
  if (raw == null || raw.trim() === '') return { ...DEFAULT_SOUND_PREFERENCES };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_SOUND_PREFERENCES };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      sound: isBoolean(obj.sound) ? obj.sound : DEFAULT_SOUND_PREFERENCES.sound,
      music: isBoolean(obj.music) ? obj.music : DEFAULT_SOUND_PREFERENCES.music,
      effects: isBoolean(obj.effects) ? obj.effects : DEFAULT_SOUND_PREFERENCES.effects,
    };
  } catch {
    return { ...DEFAULT_SOUND_PREFERENCES };
  }
}

/**
 * Root menu value summary: On / Music only / Effects only / Off.
 * Master off, or master on with both channels off → Off.
 */
export function soundPreferenceSummaryKey(prefs: SoundPreferences): MessageKey {
  if (!prefs.sound) return 'soundSummaryOff';
  if (prefs.music && prefs.effects) return 'soundSummaryOn';
  if (prefs.music && !prefs.effects) return 'soundSummaryMusicOnly';
  if (!prefs.music && prefs.effects) return 'soundSummaryEffectsOnly';
  return 'soundSummaryOff';
}

export async function loadStoredSound(): Promise<SoundPreferences> {
  try {
    const raw = await driver.getItem(SOUND_PREFERENCES_STORAGE_KEY);
    return parseSoundPreferences(raw);
  } catch {
    return { ...DEFAULT_SOUND_PREFERENCES };
  }
}

export async function persistSound(value: SoundPreferences): Promise<void> {
  try {
    const prefs: SoundPreferences = {
      sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_SOUND_PREFERENCES.sound,
      music: typeof value.music === 'boolean' ? value.music : DEFAULT_SOUND_PREFERENCES.music,
      effects:
        typeof value.effects === 'boolean' ? value.effects : DEFAULT_SOUND_PREFERENCES.effects,
    };
    await driver.setItem(SOUND_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore persistence failures
  }
}
