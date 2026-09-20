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

/**
 * Resolve app locale:
 * 1. Web `?locale=` override (when supported)
 * 2. Default (`en`)
 *
 * Device/browser locale is intentionally ignored so content and UI stay on `en`
 * unless the URL explicitly selects another supported locale.
 */
export function resolveAppLocale(options?: {
  urlLocale?: string | null;
}): AppLocale {
  return resolveLocalePreference({
    urlLocale: options?.urlLocale ?? readWebLocaleParam(),
  });
}

/** Apply resolved locale to the shared i18n catalog (call once at app start). */
export function applyResolvedLocale(options?: {
  urlLocale?: string | null;
}): AppLocale {
  const locale = resolveAppLocale(options);
  setActiveLocale(locale);
  return locale;
}
