import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';

const API_URL = resolveApiBaseUrl();

export type ConceptItem = {
  concept: string;
  shortDescription: string;
  larelality?: number;
  wikiUrl: string | null;
  mediaUrl: string | null;
};

export type ConceptRelationshipsResponse = {
  data: {
    /** 1 = simplest labels … 5 = dense academic; echoed from request or server default */
    complexity: number;
    seed: ConceptItem;
    related_concepts: ConceptItem[];
  };
  status: string;
};

/** Default complexity when not specified — matches API `concepts.default_complexity` (2). */
export const DEFAULT_CONCEPT_COMPLEXITY = 2;

export async function fetchConceptRelationships(
  options?: { seed?: string; count?: number; complexity?: number }
): Promise<ConceptRelationshipsResponse['data']> {
  const body: { seed?: string; count?: number; complexity?: number } = {};
  if (options?.seed != null && options.seed.trim() !== '') body.seed = options.seed.trim();
  if (options?.count != null) body.count = options.count;
  // Always send complexity so the API and proxies see an explicit tier (defaults to 2).
  body.complexity = options?.complexity ?? DEFAULT_CONCEPT_COMPLEXITY;

  const res = await fetch(`${API_URL}/api/concepts/relationships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to fetch concepts');
  }

  const json = (await res.json()) as ConceptRelationshipsResponse;
  if (json.status !== 'success' || !json.data) {
    throw new Error('Invalid response from API');
  }
  return json.data;
}
