import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import { assertAndFilterGraphLocale } from '@/lib/graphLocale';
import { getActiveLocale, isSupportedLocale, t } from '@/lib/i18n';
import { buildRelationshipsRequestBody } from '@/lib/testQueryParams';

const API_URL = resolveApiBaseUrl();

/** Media attribution belongs to the asset, independently of its reference link. */
export type ConceptMedia = {
  url: string;
  kind: string;
  license?: string | null;
  creator?: string | null;
  source?: string | null;
  /** Purpose-based fit (Lz-55). Production rows may omit until enrichment. */
  purpose?: string | null;
  /** Cover focal point 0–1; centre when absent. */
  focalX?: number | null;
  focalY?: number | null;
  alt?: string | null;
  sourcePageUrl?: string | null;
  licenceName?: string | null;
  licenceUrl?: string | null;
  changeNotice?: string | null;
  tone?: string | null;
};

export type ConceptItem = {
  concept: string;
  shortDescription: string;
  wikiUrl: string | null;
  mediaUrl: string | null;
  media?: ConceptMedia[];
  /** Stored laterality grade for a dealt card (Lz-57). */
  grade?: 1 | 2 | 3 | 4 | 5;
};

export type ConceptGraphNode = {
  id: number;
  label: string;
  shortDescription: string;
  complexity: number;
  wikiUrl: string | null;
  mediaUrl: string | null;
  media?: ConceptMedia[];
  /** Present on API payloads; used to reject cross-locale leakage. */
  locale?: string;
};

export type ConceptGraphEdge = {
  id: number;
  from: number;
  to: number;
  laterality?: number;
};

export type ConceptGraphResponse = {
  data: {
    start: { id: number; label: string };
    nodes: ConceptGraphNode[];
    edges: ConceptGraphEdge[];
    meta: { depth: number; limit: number; minStrength: number; hasMore: boolean; locale?: string; laterality?: number };
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

export async function fetchConceptRelationships(
  options?: {
    start?: string;
    canonicalStart?: string;
    onlyWithMedia?: boolean;
    limit?: number;
    depth?: number;
    minStrength?: number;
    complexity?: number;
    laterality?: number;
    locale?: string;
  }
): Promise<ConceptGraphResponse['data']> {
  const locale = options?.locale ?? getActiveLocale();
  const body = buildRelationshipsRequestBody({
    start: options?.start,
    canonicalStart: options?.canonicalStart,
    onlyWithMedia: options?.onlyWithMedia,
    limit: options?.limit,
    depth: options?.depth,
    minStrength: options?.minStrength,
    complexity: options?.complexity,
    laterality: options?.laterality,
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
