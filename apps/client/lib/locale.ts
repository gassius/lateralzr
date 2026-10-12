import { Platform } from 'react-native';
import {
  type AppLocale,
  resolveLocalePreference,
  setActiveLocale,
} from '@/lib/i18n';

function readWebLocaleParam(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  try {
    return new URLSearchParams(window.location.search).get('locale');
  } catch {
    return null;
  }
}

/** Best-effort device/browser language tag (BCP-47). */
export function readDeviceLocaleTag(): string | null {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined') return null;
    return navigator.language ?? null;
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

/**
 * Resolve app locale:
 * 1. Explicit stored choice
 * 2. Web `?locale=` override (when supported)
 * 3. Device/browser locale
 * 4. Default (`en`)
 */
export function resolveAppLocale(options?: {
  storedLocale?: string | null;
  urlLocale?: string | null;
  deviceLocale?: string | null;
}): AppLocale {
  return resolveLocalePreference({
    storedLocale: options?.storedLocale,
    urlLocale: options?.urlLocale ?? readWebLocaleParam(),
    deviceLocale: options?.deviceLocale ?? readDeviceLocaleTag(),
  });
}

/** Apply resolved locale to the shared i18n catalog (call once at app start). */
export function applyResolvedLocale(options?: {
  storedLocale?: string | null;
  urlLocale?: string | null;
  deviceLocale?: string | null;
}): AppLocale {
  const locale = resolveAppLocale(options);
  setActiveLocale(locale);
  return locale;
}
