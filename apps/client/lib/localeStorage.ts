import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupportedLocale, type AppLocale } from '@/lib/i18n';

const STORAGE_KEY = 'lateralzr.appLocale';

/** Load an explicit locale choice, or `null` when none is stored. */
export async function loadStoredLocale(): Promise<AppLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw.trim() === '') return null;
    const cleaned = raw.trim().toLowerCase();
    if (!isSupportedLocale(cleaned)) return null;
    return cleaned;
  } catch {
    return null;
  }
}

export async function persistLocale(value: AppLocale): Promise<void> {
  try {
    if (!isSupportedLocale(value)) return;
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore persistence failures
  }
}
