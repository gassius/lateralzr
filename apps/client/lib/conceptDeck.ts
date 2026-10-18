import type { ConceptMedia } from './api';

export type DeckConcept = {
  concept: string;
  shortDescription: string;
  wikiUrl: string | null;
  mediaUrl: string | null;
  media?: ConceptMedia[];
  /** Edge laterality that dealt this card (1–5). Start seeds may omit it. */
  grade?: 1 | 2 | 3 | 4 | 5;
};

export type DeckGraphNode = {
  id: number;
  label: string;
  shortDescription: string;
  wikiUrl: string | null;
  mediaUrl: string | null;
  media?: ConceptMedia[];
};

export type DeckGraphEdge = {
  from: number;
  to: number;
  laterality?: number;
};

export type DeckGraph = {
  start?: { id: number; label: string };
  nodes?: DeckGraphNode[] | null;
  edges?: DeckGraphEdge[] | null;
};

export function conceptKey(concept: string): string {
  return concept.trim().toLowerCase();
}

/** Append incoming concepts, skipping names already present (case-insensitive). */
export function mergeUniqueRelated(existing: DeckConcept[], related: DeckConcept[]): DeckConcept[] {
  const seen = new Set(existing.map((c) => conceptKey(c.concept)));
  return related.filter((c) => {
    const k = conceptKey(c.concept);
    return k.length > 0 && !seen.has(k);
  });
}

function parseEdgeGrade(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const n = Math.round(value);
  if (n < 1 || n > 5) return undefined;
  return n as 1 | 2 | 3 | 4 | 5;
}

function nodeToItem(node: DeckGraphNode, grade?: 1 | 2 | 3 | 4 | 5): DeckConcept {
  return {
    concept: node.label,
    shortDescription: node.shortDescription,
    wikiUrl: node.wikiUrl,
    mediaUrl: node.mediaUrl,
    ...(node.media?.length ? { media: node.media } : {}),
    ...(grade != null ? { grade } : {}),
  };
}

/**
 * Walk the graph from `start` so the deck follows lateral connections.
 *
 * The relationships API returns `nodes` in DB order, not neighborhood order.
 * Using the last array item as the next seed often re-fetches the original start
 * and yields zero new cards — the client then stays on the loading logo.
 */
export function graphToDeckItems(data: DeckGraph): DeckConcept[] {
  const nodes = data.nodes ?? [];
  if (nodes.length === 0) return [];

  const byId = new Map<number, DeckGraphNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  const adj = new Map<number, Array<{ id: number; grade?: 1 | 2 | 3 | 4 | 5 }>>();
  const addEdge = (from: number, to: number, grade?: 1 | 2 | 3 | 4 | 5) => {
    const list = adj.get(from);
    const hop = { id: to, grade };
    if (list) {
      list.push(hop);
    } else {
      adj.set(from, [hop]);
    }
  };
  for (const edge of data.edges ?? []) {
    const grade = parseEdgeGrade(edge.laterality);
    addEdge(edge.from, edge.to, grade);
    addEdge(edge.to, edge.from, grade);
  }

  const ordered: Array<{ node: DeckGraphNode; grade?: 1 | 2 | 3 | 4 | 5 }> = [];
  const seen = new Set<number>();
  const queue: Array<{ id: number; grade?: 1 | 2 | 3 | 4 | 5 }> = [];
  const startId = data.start?.id;

  if (startId != null && byId.has(startId)) {
    queue.push({ id: startId });
    seen.add(startId);
  }

  while (queue.length > 0) {
    const hop = queue.shift()!;
    const node = byId.get(hop.id);
    if (!node) continue;
    ordered.push({ node, grade: hop.grade });
    for (const next of adj.get(hop.id) ?? []) {
      if (seen.has(next.id) || !byId.has(next.id)) continue;
      seen.add(next.id);
      queue.push(next);
    }
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push({ node });
      seen.add(node.id);
    }
  }

  return ordered.map(({ node, grade }) => nodeToItem(node, grade));
}

export type LoadMorePlan =
  | { action: 'append'; add: DeckConcept[] }
  | { action: 'coldStart' }
  | { action: 'retryEmpty' };

/**
 * After a load-more fetch: append unique cards; if a seeded neighborhood was
 * entirely already in the deck, cold-start instead of retrying the same seed.
 */
export function planLoadMoreMerge(
  existing: DeckConcept[],
  incoming: DeckConcept[],
  didUseSeed: boolean,
): LoadMorePlan {
  const add = mergeUniqueRelated(existing, incoming);
  if (add.length > 0) return { action: 'append', add };
  if (didUseSeed) return { action: 'coldStart' };
  return { action: 'retryEmpty' };
}

export type AppendedBatch = {
  concepts: DeckConcept[];
  /** First new card index when the user is waiting on the end-of-deck logo. */
  nextIndex: number | null;
  pendingEndDeckLoad: boolean;
};

export type ComplexityTreeSwap = {
  concepts: DeckConcept[];
  currentIndex: number;
  /** True when the swap added at least one new upcoming card. */
  clearedEndDeckLoad: boolean;
};

/**
 * Replace the stale upcoming walk with a freshly prefetched tree, keeping the
 * cards already seen (and the current card) so the deck does not jump.
 */
export function applyComplexityTreeSwap(
  existing: DeckConcept[],
  currentIndex: number,
  incoming: DeckConcept[],
): ComplexityTreeSwap {
  if (existing.length === 0) {
    return {
      concepts: incoming,
      currentIndex: 0,
      clearedEndDeckLoad: incoming.length > 0,
    };
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), existing.length - 1);
  if (incoming.length === 0) {
    return { concepts: existing, currentIndex: safeIndex, clearedEndDeckLoad: false };
  }

  const prefix = existing.slice(0, safeIndex + 1);
  const add = mergeUniqueRelated(prefix, incoming);
  if (add.length === 0) {
    return { concepts: existing, currentIndex: safeIndex, clearedEndDeckLoad: false };
  }

  return {
    concepts: [...prefix, ...add],
    currentIndex: safeIndex,
    clearedEndDeckLoad: true,
  };
}

export function applyAppendedBatch(
  existing: DeckConcept[],
  add: DeckConcept[],
  pendingEndDeckLoad: boolean,
): AppendedBatch {
  if (add.length === 0) {
    return { concepts: existing, nextIndex: null, pendingEndDeckLoad };
  }
  const concepts = [...existing, ...add];
  if (!pendingEndDeckLoad) {
    return { concepts, nextIndex: null, pendingEndDeckLoad: false };
  }
  return {
    concepts,
    nextIndex: existing.length,
    pendingEndDeckLoad: false,
  };
}
