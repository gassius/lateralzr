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

function readDeviceLocale(): string | null {
  try {
    // Prefer expo-localization when available (native + web).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as {
      getLocales?: () => Array<{ languageTag?: string; languageCode?: string }>;
      locale?: string;
    };
    const locales = Localization.getLocales?.() ?? [];
    const first = locales[0];
    if (first?.languageTag) return first.languageTag;
    if (first?.languageCode) return first.languageCode;
    if (typeof Localization.locale === 'string') return Localization.locale;
  } catch {
    // Package may be absent in some test/runtime contexts.
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.language ?? (navigator.languages?.[0] ?? null);
  }

  return null;
}

/**
 * Resolve app locale:
 * 1. Web `?locale=` override
 * 2. Device / browser locale
 * 3. Default (`en`)
 */
export function resolveAppLocale(options?: {
  urlLocale?: string | null;
  deviceLocale?: string | null;
}): AppLocale {
  return resolveLocalePreference({
    urlLocale: options?.urlLocale ?? readWebLocaleParam(),
    deviceLocale: options?.deviceLocale ?? readDeviceLocale(),
  });
}

/** Apply resolved locale to the shared i18n catalog (call once at app start). */
export function applyResolvedLocale(options?: {
  urlLocale?: string | null;
  deviceLocale?: string | null;
}): AppLocale {
  const locale = resolveAppLocale(options);
  setActiveLocale(locale);
  return locale;
}
