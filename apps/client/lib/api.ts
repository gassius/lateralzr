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
    seed: ConceptItem;
    related_concepts: ConceptItem[];
  };
  status: string;
};

export async function fetchConceptRelationships(
  options?: { seed?: string; count?: number }
): Promise<ConceptRelationshipsResponse['data']> {
  const body: { seed?: string; count?: number } = {};
  if (options?.seed != null && options.seed.trim() !== '') body.seed = options.seed.trim();
  if (options?.count != null) body.count = options.count;

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
