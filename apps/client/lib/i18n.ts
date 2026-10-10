export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

/** Every UI label key used by the client (existing + v3.3 Lz-43). */
export const MESSAGE_KEYS = [
  // Existing keys (keep while still referenced)
  'swipeCoach',
  'flipCoach',
  'noDescription',
  'wikipedia',
  'illustrationFor',
  'loadingMoreIdeas',
  'couldNotLoadMore',
  'tapToRetry',
  'failedToLoadConcepts',
  'failedToFetchConcepts',
  'invalidApiResponse',
  'decreaseLaterality',
  'increaseLaterality',
  'complexityGrade',
  'loadingLateralNeighborhood',
  // v3.3 UI labels (Lz-43)
  'lateralityGrade1',
  'lateralityGrade2',
  'lateralityGrade3',
  'lateralityGrade4',
  'lateralityGrade5',
  'laterality',
  'lateralityA11yValue',
  'lateralitySheetTitle',
  'lateralitySheetHelper',
  'close',
  'openMenu',
  'menuTitle',
  'menuLanguage',
  'menuComplexity',
  'menuMotion',
  'motionSystem',
  'motionReduced',
  'motionFull',
  'menuAbout',
  'menuReplayTips',
  'languageEn',
  'languageEs',
  'aboutConcept',
  'aboutPromise',
  'findingStart',
  'offline',
  'retry',
  'fetchFailed',
  'noNextIdea',
  'adjust',
  'actionNext',
  'actionPrevious',
  'actionTurn',
  'actionComplexityUp',
  'actionComplexityDown',
  'tipTap',
  'tipSwipe',
  'tipComplexity',
  'webTitle',
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

/** Raw locale catalogs (no fallback). Exported for parity tests. */
export const messages: Record<AppLocale, Record<MessageKey, string>> = {
  en: {
    swipeCoach: 'Swipe for another idea',
    flipCoach: 'Tap the card to learn more',
    noDescription: "There isn't a description for this concept yet.",
    wikipedia: 'Wikipedia',
    illustrationFor: 'Illustration for {concept}',
    loadingMoreIdeas: 'Loading more ideas…',
    couldNotLoadMore: "Couldn't load more concepts.",
    tapToRetry: 'Tap to retry',
    failedToLoadConcepts: 'Failed to load concepts',
    failedToFetchConcepts: 'Failed to fetch concepts',
    invalidApiResponse: 'Invalid response from API',
    decreaseLaterality: 'Decrease laterality',
    increaseLaterality: 'Increase laterality',
    complexityGrade: 'Complexity {grade}',
    loadingLateralNeighborhood: 'Loading a new neighborhood',
    lateralityGrade1: 'Same domain',
    lateralityGrade2: 'Shared context',
    lateralityGrade3: 'Abstract bridge',
    lateralityGrade4: 'Provocation',
    lateralityGrade5: 'Random entry',
    laterality: 'Laterality',
    lateralityA11yValue: '{label}, {n} of 5',
    lateralitySheetTitle: 'Laterality',
    lateralitySheetHelper: 'How far should the next move reach?',
    close: 'Close',
    openMenu: 'Open menu',
    menuTitle: 'Menu',
    menuLanguage: 'Language',
    menuComplexity: 'Complexity',
    menuMotion: 'Motion',
    motionSystem: 'Follow system',
    motionReduced: 'Reduced',
    motionFull: 'Full',
    menuAbout: 'About Lateralzr',
    menuReplayTips: 'Replay gesture tips',
    languageEn: 'English',
    languageEs: 'Español',
    aboutConcept: 'About {concept}',
    aboutPromise: 'A little space to think differently.',
    findingStart: 'Finding a starting point…',
    offline: 'Offline',
    retry: 'Retry',
    fetchFailed: "Couldn't load the next idea. Try again.",
    noNextIdea: 'No next idea at this setting.',
    adjust: 'Adjust',
    actionNext: 'Next concept',
    actionPrevious: 'Previous concept',
    actionTurn: 'Turn card',
    actionComplexityUp: 'More complex',
    actionComplexityDown: 'Simpler',
    tipTap: 'Tap to turn the card',
    tipSwipe: 'Swipe sideways to explore',
    tipComplexity: 'Swipe up or down to change complexity',
    webTitle: 'Lateralzr',
  },
  es: {
    swipeCoach: 'Desliza para otra idea',
    flipCoach: 'Toca la tarjeta para saber más',
    noDescription: 'Este concepto aún no tiene descripción.',
    wikipedia: 'Wikipedia',
    illustrationFor: 'Ilustración de {concept}',
    loadingMoreIdeas: 'Cargando más ideas…',
    couldNotLoadMore: 'No se pudieron cargar más conceptos.',
    tapToRetry: 'Toca para reintentar',
    failedToLoadConcepts: 'No se pudieron cargar los conceptos',
    failedToFetchConcepts: 'Error al obtener conceptos',
    invalidApiResponse: 'Respuesta inválida de la API',
    decreaseLaterality: 'Disminuir lateralidad',
    increaseLaterality: 'Aumentar lateralidad',
    complexityGrade: 'Complejidad {grade}',
    loadingLateralNeighborhood: 'Cargando un vecindario nuevo',
    lateralityGrade1: 'Mismo dominio',
    lateralityGrade2: 'Contexto compartido',
    lateralityGrade3: 'Puente abstracto',
    lateralityGrade4: 'Provocación',
    lateralityGrade5: 'Entrada aleatoria',
    laterality: 'Lateralidad',
    lateralityA11yValue: '{label}, {n} de 5',
    lateralitySheetTitle: 'Lateralidad',
    lateralitySheetHelper: '¿Hasta dónde debe llegar el siguiente paso?',
    close: 'Cerrar',
    openMenu: 'Abrir menú',
    menuTitle: 'Menú',
    menuLanguage: 'Idioma',
    menuComplexity: 'Complejidad',
    menuMotion: 'Movimiento',
    motionSystem: 'Según el sistema',
    motionReduced: 'Reducido',
    motionFull: 'Completo',
    menuAbout: 'Acerca de Lateralzr',
    menuReplayTips: 'Repetir consejos de gestos',
    languageEn: 'English',
    languageEs: 'Español',
    aboutConcept: 'Sobre {concept}',
    aboutPromise: 'Un poco de espacio para pensar distinto.',
    findingStart: 'Buscando un punto de partida…',
    offline: 'Sin conexión',
    retry: 'Reintentar',
    fetchFailed: 'No se pudo cargar la siguiente idea. Inténtalo de nuevo.',
    noNextIdea: 'No hay siguiente idea con este ajuste.',
    adjust: 'Ajustar',
    actionNext: 'Siguiente concepto',
    actionPrevious: 'Concepto anterior',
    actionTurn: 'Girar carta',
    actionComplexityUp: 'Más complejo',
    actionComplexityDown: 'Más sencillo',
    tipTap: 'Toca para girar la carta',
    tipSwipe: 'Desliza de lado para explorar',
    tipComplexity: 'Desliza arriba o abajo para cambiar la complejidad',
    webTitle: 'Lateralzr',
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
