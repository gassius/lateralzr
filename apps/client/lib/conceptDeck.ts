export type DeckConcept = {
  concept: string;
  shortDescription: string;
  laterality?: number;
  complexity?: number;
  wikiUrl: string | null;
  mediaUrl: string | null;
};

export type DeckGraphNode = {
  id: number;
  label: string;
  shortDescription: string;
  complexity?: number;
  wikiUrl: string | null;
  mediaUrl: string | null;
};

export type DeckGraphEdge = {
  from: number;
  to: number;
  strength?: number;
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

function nodeToItem(node: DeckGraphNode): DeckConcept {
  return {
    concept: node.label,
    shortDescription: node.shortDescription,
    complexity: node.complexity,
    wikiUrl: node.wikiUrl,
    mediaUrl: node.mediaUrl,
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

  const adj = new Map<number, number[]>();
  const addEdge = (from: number, to: number) => {
    const list = adj.get(from);
    if (list) {
      list.push(to);
    } else {
      adj.set(from, [to]);
    }
  };
  for (const edge of data.edges ?? []) {
    addEdge(edge.from, edge.to);
    addEdge(edge.to, edge.from);
  }

  const ordered: DeckGraphNode[] = [];
  const seen = new Set<number>();
  const queue: number[] = [];
  const startId = data.start?.id;

  if (startId != null && byId.has(startId)) {
    queue.push(startId);
    seen.add(startId);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (!node) continue;
    ordered.push(node);
    for (const nextId of adj.get(id) ?? []) {
      if (seen.has(nextId) || !byId.has(nextId)) continue;
      seen.add(nextId);
      queue.push(nextId);
    }
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push(node);
      seen.add(node.id);
    }
  }

  return ordered.map(nodeToItem);
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
