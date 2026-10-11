import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MessageKey } from '@/lib/i18n';

const STORAGE_KEY = 'lateralzr.motionPreference';

/** In-app Motion preference (Lz-46). No haptics. */
export type MotionPreference = 'system' | 'reduced' | 'full';

export const DEFAULT_MOTION_PREFERENCE: MotionPreference = 'system';

export const MOTION_PREFERENCE_OPTIONS: readonly MotionPreference[] = [
  'system',
  'reduced',
  'full',
] as const;

const LABEL_KEYS: Record<MotionPreference, MessageKey> = {
  system: 'motionSystem',
  reduced: 'motionReduced',
  full: 'motionFull',
};

export function isMotionPreference(value: string): value is MotionPreference {
  return (MOTION_PREFERENCE_OPTIONS as readonly string[]).includes(value);
}

/** Parse stored / raw value; unknown → System default. */
export function parseMotionPreference(raw: string | null | undefined): MotionPreference {
  if (raw == null) return DEFAULT_MOTION_PREFERENCE;
  const cleaned = raw.trim().toLowerCase();
  if (isMotionPreference(cleaned)) return cleaned;
  return DEFAULT_MOTION_PREFERENCE;
}

export function motionPreferenceLabelKey(pref: MotionPreference): MessageKey {
  return LABEL_KEYS[pref];
}

export async function loadStoredMotionPreference(): Promise<MotionPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw.trim() === '') return DEFAULT_MOTION_PREFERENCE;
    return parseMotionPreference(raw);
  } catch {
    return DEFAULT_MOTION_PREFERENCE;
  }
}

export async function persistMotionPreference(value: MotionPreference): Promise<void> {
  try {
    const pref = isMotionPreference(value) ? value : DEFAULT_MOTION_PREFERENCE;
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore persistence failures
  }
}
