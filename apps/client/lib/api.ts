import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import { graphToDeckItems } from '@/lib/conceptDeck';

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
    meta: { depth: number; limit: number; minStrength: number; hasMore: boolean };
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
  options?: { start?: string; seed?: string; limit?: number; depth?: number; minStrength?: number; complexity?: number }
): Promise<ConceptGraphResponse['data']> {
  const body: { start?: string; limit?: number; depth?: number; minStrength?: number } = {};
  const start = options?.start ?? options?.seed;
  if (start != null && start.trim() !== '') body.start = start.trim();
  if (options?.limit != null) body.limit = options.limit;
  if (options?.depth != null) body.depth = options.depth;
  if (options?.minStrength != null) body.minStrength = options.minStrength;

  const res = await fetch(`${API_URL}/api/concepts/relationships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      (err as { message?: string }).message ?? 'Failed to fetch concepts',
      res.status,
    );
  }

  const json = (await res.json()) as ConceptGraphResponse;
  if (json.status !== 'success' || !json.data) {
    throw new Error('Invalid response from API');
  }
  return json.data;
}

export function graphNodesToConceptItems(data: ConceptGraphResponse['data']): ConceptItem[] {
  return graphToDeckItems(data);
}
