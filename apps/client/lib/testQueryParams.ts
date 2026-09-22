import { parseLateralityParam, type LateralityGrade } from './laterality';

export type JourneyTestParams = {
  localizedConcept?: string;
  canonicalConcept?: string;
  onlyWithMedia: boolean;
  /** Forced initial complexity from `?complexity=N` (1–5). */
  complexity?: number;
  /** Expo-web `?laterality=4`. Absent when blank/invalid. */
  laterality?: LateralityGrade;
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
  complexity?: number;
  laterality?: number;
};

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function parseBooleanFlag(value: string | null): boolean {
  if (value == null) return false;
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

/** Integer 1–5 only. Blank, floats, and out-of-range values are ignored. */
export function parseComplexityParam(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || !/^-?\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return undefined;
  }
  return n;
}

/** URL `?complexity=N` wins for this session/load only. */
export function resolveInitialComplexity(params: JourneyTestParams, stored: number): number {
  return params.complexity ?? stored;
}

export type ComplexityPersistReason = 'hydrate' | 'swipe' | 'fallback';

/** Persist only after the user swipes up/down. Deep-link overrides stay session-only. */
export function shouldPersistComplexity(reason: ComplexityPersistReason): boolean {
  return reason === 'swipe';
}

export type HydratedComplexity = {
  complexity: number;
  persist: boolean;
};

/** Apply a URL complexity for this load without overwriting stored preference. */
export function resolveHydratedComplexity(
  params: JourneyTestParams,
  stored: number,
): HydratedComplexity {
  return {
    complexity: resolveInitialComplexity(params, stored),
    persist: shouldPersistComplexity('hydrate'),
  };
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
    const complexity = parseComplexityParam(params.get('complexity'));
    return {
      localizedConcept: trimOrUndefined(params.get('localizedConcept')),
      canonicalConcept: trimOrUndefined(params.get('canonicalConcept')),
      onlyWithMedia: parseBooleanFlag(params.get('onlyWithMedia')),
      ...(complexity != null ? { complexity } : {}),
      laterality: parseLateralityParam(params.get('laterality')),
    };
  } catch {
    return { onlyWithMedia: false };
  }
}

/**
 * Expo Router / Metro web sometimes replace `/?a=1` with `/` after boot.
 * Remember the first non-empty search so session params still apply.
 */
let rememberedWebSearch = '';

/** Keep the first non-empty `?…` string. Empty input does not erase memory. */
export function rememberWebSearch(search: string | null | undefined): string {
  const trimmed = (search ?? '').trim();
  if (trimmed && trimmed !== '?') {
    rememberedWebSearch = trimmed.startsWith('?') ? trimmed : `?${trimmed}`;
  }
  return rememberedWebSearch;
}

/** Test-only: clear the remembered search. */
export function resetRememberedWebSearch(): void {
  rememberedWebSearch = '';
}

function liveWebSearch(): string {
  if (typeof window === 'undefined') return rememberedWebSearch;
  try {
    rememberWebSearch(window.location?.search);
    if (!rememberedWebSearch && window.location?.href) {
      rememberWebSearch(new URL(window.location.href).search);
    }
  } catch {
    // ignore
  }
  return rememberedWebSearch;
}

/** Read test params from the current web URL. Native / SSR return empty overrides. */
export function readJourneyTestParams(): JourneyTestParams {
  const search = liveWebSearch();
  if (!search) return { onlyWithMedia: false };
  try {
    return parseJourneyTestParams(search);
  } catch {
    return { onlyWithMedia: false };
  }
}

if (typeof window !== 'undefined') {
  rememberWebSearch(window.location?.search);
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
    // Also send as `start` so current production (which only knows term lookup)
    // still resolves keys that match a localized/English term.
    options.start = params.canonicalConcept;
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
  complexity?: number;
  laterality?: number;
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
  const complexity = parseComplexityParam(
    options?.complexity == null ? undefined : String(options.complexity),
  );
  if (complexity != null) body.complexity = complexity;
  if (options?.laterality != null) {
    const laterality = Math.round(options.laterality);
    if (laterality >= 1 && laterality <= 5) body.laterality = laterality;
  }
  return body;
}
