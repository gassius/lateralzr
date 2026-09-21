import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import { graphToDeckItems } from '@/lib/conceptDeck';
import { assertAndFilterGraphLocale } from '@/lib/graphLocale';
import { getActiveLocale, isSupportedLocale, t } from '@/lib/i18n';
import { buildRelationshipsRequestBody } from '@/lib/testQueryParams';

const API_URL = resolveApiBaseUrl();

export type ConceptItem = {
  concept: string;
  shortDescription: string;
  laterality?: number;
  complexity?: number;
  wikiUrl: string | null;
  mediaUrl: string | null;
};

export type ConceptGraphNode = {
  id: number;
  label: string;
  shortDescription: string;
  complexity: number;
  wikiUrl: string | null;
  mediaUrl: string | null;
  degree: number;
  /** Present on API payloads; used to reject cross-locale leakage. */
  locale?: string;
};

export type ConceptGraphEdge = {
  id: number;
  from: number;
  to: number;
  strength: number;
  laterality: number;
};

export type ConceptGraphResponse = {
  data: {
    start: { id: number; label: string };
    nodes: ConceptGraphNode[];
    edges: ConceptGraphEdge[];
    meta: { depth: number; limit: number; minStrength: number; hasMore: boolean; locale?: string };
  };
  status: string;
};

/** Default complexity when not specified — matches API `concepts.default_complexity` (2). */
export const DEFAULT_CONCEPT_COMPLEXITY = 2;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export { assertAndFilterGraphLocale } from '@/lib/graphLocale';

export async function fetchConceptRelationships(
  options?: {
    start?: string;
    seed?: string;
    canonicalStart?: string;
    onlyWithMedia?: boolean;
    limit?: number;
    depth?: number;
    minStrength?: number;
    complexity?: number;
    locale?: string;
  }
): Promise<ConceptGraphResponse['data']> {
  const locale = options?.locale ?? getActiveLocale();
  const body = buildRelationshipsRequestBody({
    start: options?.start,
    seed: options?.seed,
    canonicalStart: options?.canonicalStart,
    onlyWithMedia: options?.onlyWithMedia,
    limit: options?.limit,
    depth: options?.depth,
    minStrength: options?.minStrength,
    locale,
  });

  const res = await fetch(`${API_URL}/api/concepts/relationships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      (err as { message?: string }).message ?? t('failedToFetchConcepts'),
      res.status,
    );
  }

  const json = (await res.json()) as ConceptGraphResponse;
  if (json.status !== 'success' || !json.data) {
    throw new Error(t('invalidApiResponse'));
  }

  const expected = isSupportedLocale(locale) ? locale : getActiveLocale();
  return assertAndFilterGraphLocale(json.data, expected);
}

export function graphNodesToConceptItems(data: ConceptGraphResponse['data']): ConceptItem[] {
  return graphToDeckItems(data);
}
