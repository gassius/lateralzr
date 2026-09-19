export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

type MessageKey =
  | 'tapToFlip'
  | 'tapToFlipBack'
  | 'noDescription'
  | 'wikipedia'
  | 'imageUnavailable'
  | 'illustrationFor'
  | 'loadingMoreIdeas'
  | 'couldNotLoadMore'
  | 'tapToRetry'
  | 'failedToLoadConcepts'
  | 'failedToFetchConcepts'
  | 'invalidApiResponse';

const messages: Record<AppLocale, Record<MessageKey, string>> = {
  en: {
    tapToFlip: 'Tap to flip',
    tapToFlipBack: 'Tap to flip back',
    noDescription: 'No description.',
    wikipedia: 'Wikipedia',
    imageUnavailable: 'Image unavailable',
    illustrationFor: 'Illustration for {concept}',
    loadingMoreIdeas: 'Loading more ideas…',
    couldNotLoadMore: "Couldn't load more concepts.",
    tapToRetry: 'Tap to retry',
    failedToLoadConcepts: 'Failed to load concepts',
    failedToFetchConcepts: 'Failed to fetch concepts',
    invalidApiResponse: 'Invalid response from API',
  },
  es: {
    tapToFlip: 'Toca para voltear',
    tapToFlipBack: 'Toca para volver',
    noDescription: 'Sin descripción.',
    wikipedia: 'Wikipedia',
    imageUnavailable: 'Imagen no disponible',
    illustrationFor: 'Ilustración de {concept}',
    loadingMoreIdeas: 'Cargando más ideas…',
    couldNotLoadMore: 'No se pudieron cargar más conceptos.',
    tapToRetry: 'Toca para reintentar',
    failedToLoadConcepts: 'No se pudieron cargar los conceptos',
    failedToFetchConcepts: 'Error al obtener conceptos',
    invalidApiResponse: 'Respuesta inválida de la API',
  },
};

let activeLocale: AppLocale = DEFAULT_LOCALE;

export function isSupportedLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Map BCP-47 / device tags (es-ES, en_US) onto a supported app locale. */
export function normalizeLocaleTag(tag: string | null | undefined): AppLocale | null {
  if (tag == null) return null;
  const cleaned = tag.trim().toLowerCase().replace('_', '-');
  if (!cleaned) return null;
  if (isSupportedLocale(cleaned)) return cleaned;
  const primary = cleaned.split('-')[0] ?? '';
  if (isSupportedLocale(primary)) return primary;
  return null;
}

export function setActiveLocale(locale: AppLocale): void {
  activeLocale = locale;
}

export function getActiveLocale(): AppLocale {
  return activeLocale;
}

/**
 * Pure locale preference resolution (no platform APIs).
 * Order: URL override → device/browser → default.
 */
export function resolveLocalePreference(options?: {
  urlLocale?: string | null;
  deviceLocale?: string | null;
}): AppLocale {
  const fromUrl = normalizeLocaleTag(options?.urlLocale);
  if (fromUrl) return fromUrl;

  const fromDevice = normalizeLocaleTag(options?.deviceLocale);
  if (fromDevice) return fromDevice;

  return DEFAULT_LOCALE;
}

export function t(key: MessageKey, vars?: Record<string, string>): string {
  const catalog = messages[activeLocale] ?? messages[DEFAULT_LOCALE];
  let text = catalog[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}
