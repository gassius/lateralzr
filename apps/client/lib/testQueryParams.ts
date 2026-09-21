export type JourneyTestParams = {
  localizedConcept?: string;
  canonicalConcept?: string;
  onlyWithMedia: boolean;
};

export type JourneyFetchOptions = {
  start?: string;
  canonicalStart?: string;
  onlyWithMedia?: boolean;
};

export type RelationshipsRequestBody = {
  start?: string;
  canonicalStart?: string;
  onlyWithMedia?: boolean;
  limit?: number;
  depth?: number;
  minStrength?: number;
  locale?: string;
};

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function parseBooleanFlag(value: string | null): boolean {
  if (value == null) return false;
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

/**
 * Parse Expo-web test overrides from a query string.
 * Invalid / empty values are ignored so the app can cold-start normally.
 */
export function parseJourneyTestParams(
  search: string | URLSearchParams | null | undefined,
): JourneyTestParams {
  try {
    const raw =
      search instanceof URLSearchParams
        ? search
        : typeof search === 'string'
          ? search.replace(/^\?+/, '')
          : '';
    const params = new URLSearchParams(raw);
    return {
      localizedConcept: trimOrUndefined(params.get('localizedConcept')),
      canonicalConcept: trimOrUndefined(params.get('canonicalConcept')),
      onlyWithMedia: parseBooleanFlag(params.get('onlyWithMedia')),
    };
  } catch {
    return { onlyWithMedia: false };
  }
}

/** Read test params from the current web URL. Native / SSR return empty overrides. */
export function readJourneyTestParams(): JourneyTestParams {
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') {
    return { onlyWithMedia: false };
  }
  try {
    return parseJourneyTestParams(window.location.search);
  } catch {
    return { onlyWithMedia: false };
  }
}

/**
 * Map URL test params onto the relationships request.
 * `localizedConcept` wins over `canonicalConcept` (go directly to that label).
 */
export function journeyStartOptions(params: JourneyTestParams): JourneyFetchOptions {
  const options: JourneyFetchOptions = {};
  if (params.localizedConcept) {
    options.start = params.localizedConcept;
  } else if (params.canonicalConcept) {
    options.canonicalStart = params.canonicalConcept;
  }
  if (params.onlyWithMedia) {
    options.onlyWithMedia = true;
  }
  return options;
}

export function hasNamedJourneyStart(params: JourneyTestParams): boolean {
  return Boolean(params.localizedConcept || params.canonicalConcept);
}

/**
 * When a named start 404s, retry as a cold start (keeping onlyWithMedia).
 * Other errors are left to the caller.
 */
export function resolveJourneyStartFallback(
  params: JourneyTestParams,
  error: unknown,
): JourneyFetchOptions | null {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status)
      : Number.NaN;
  if (!hasNamedJourneyStart(params) || status !== 404) {
    return null;
  }
  return params.onlyWithMedia ? { onlyWithMedia: true } : {};
}

export function applyJourneyTestDeck<T extends { concept: string; mediaUrl: string | null }>(
  items: T[],
  params: JourneyTestParams,
): T[] {
  let next = items;
  if (params.onlyWithMedia) {
    next = next.filter((item) => (item.mediaUrl?.trim() ?? '') !== '');
  }

  const start = params.localizedConcept?.trim();
  if (!start) return next;

  const key = start.toLowerCase();
  const index = next.findIndex((item) => item.concept.trim().toLowerCase() === key);
  if (index <= 0) return next;

  const chosen = next[index];
  if (!chosen) return next;
  return [chosen, ...next.slice(0, index), ...next.slice(index + 1)];
}

export function buildRelationshipsRequestBody(options?: {
  start?: string;
  seed?: string;
  canonicalStart?: string;
  onlyWithMedia?: boolean;
  limit?: number;
  depth?: number;
  minStrength?: number;
  locale?: string;
}): RelationshipsRequestBody {
  const body: RelationshipsRequestBody = {};
  const start = options?.start ?? options?.seed;
  if (start != null && start.trim() !== '') body.start = start.trim();
  if (options?.canonicalStart != null && options.canonicalStart.trim() !== '') {
    body.canonicalStart = options.canonicalStart.trim();
  }
  if (options?.onlyWithMedia) body.onlyWithMedia = true;
  if (options?.limit != null) body.limit = options.limit;
  if (options?.depth != null) body.depth = options.depth;
  if (options?.minStrength != null) body.minStrength = options.minStrength;
  if (options?.locale != null) body.locale = options.locale;
  return body;
}
