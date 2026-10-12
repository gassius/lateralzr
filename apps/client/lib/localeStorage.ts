import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupportedLocale, type AppLocale } from '@/lib/i18n';

const STORAGE_KEY = 'lateralzr.appLocale';

type LocaleStorageDriver = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

let driver: LocaleStorageDriver = AsyncStorage;

/** Tests inject an in-memory map so Node can run without `window`. */
export function useLocaleStorageDriver(next: LocaleStorageDriver | null): void {
  driver = next ?? AsyncStorage;
}

/**
 * Apply a picked locale and persist it. Both deps must run — a no-op persist
 * or a skipped setActive fails the pick test.
 */
export function selectLocale(
  next: AppLocale,
  deps: {
    setActive: (locale: AppLocale) => void;
    persist: (locale: AppLocale) => void | Promise<void>;
  },
): void {
  if (!isSupportedLocale(next)) return;
  deps.setActive(next);
  void deps.persist(next);
}

/** Load an explicit locale choice, or `null` when none is stored. */
export async function loadStoredLocale(): Promise<AppLocale | null> {
  try {
    const raw = await driver.getItem(STORAGE_KEY);
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
    await driver.setItem(STORAGE_KEY, value);
  } catch {
    // ignore persistence failures
  }
}
