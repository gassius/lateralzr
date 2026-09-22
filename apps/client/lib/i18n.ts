export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

type MessageKey =
  | 'swipeCoach'
  | 'flipCoach'
  | 'noDescription'
  | 'wikipedia'
  | 'imageUnavailable'
  | 'illustrationFor'
  | 'loadingMoreIdeas'
  | 'couldNotLoadMore'
  | 'tapToRetry'
  | 'failedToLoadConcepts'
  | 'failedToFetchConcepts'
  | 'invalidApiResponse'
  | 'decreaseLaterality'
  | 'increaseLaterality'
  | 'lateralityGrade';

const messages: Record<AppLocale, Record<MessageKey, string>> = {
  en: {
    swipeCoach: 'Swipe for another idea',
    flipCoach: 'Tap the card to learn more',
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
    decreaseLaterality: 'Decrease laterality',
    increaseLaterality: 'Increase laterality',
    lateralityGrade: 'Laterality {grade}',
  },
  es: {
    swipeCoach: 'Desliza para otra idea',
    flipCoach: 'Toca la tarjeta para saber más',
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
    decreaseLaterality: 'Disminuir laterality',
    increaseLaterality: 'Aumentar laterality',
    lateralityGrade: 'Laterality {grade}',
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
 * Order: explicit URL override → default (`en`).
 * Device/browser locale is never used so Spanish devices still default to English
 * unless `?locale=` (or an explicit urlLocale) selects another supported locale.
 */
export function resolveLocalePreference(options?: {
  urlLocale?: string | null;
}): AppLocale {
  const fromUrl = normalizeLocaleTag(options?.urlLocale);
  if (fromUrl) return fromUrl;

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
