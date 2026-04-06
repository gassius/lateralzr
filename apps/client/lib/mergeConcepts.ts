import type { ConceptItem } from '@/lib/api';

/** Append API `related_concepts`, skipping concepts already present (by name, case-insensitive). */
export function mergeUniqueRelated(existing: ConceptItem[], related: ConceptItem[]): ConceptItem[] {
  const seen = new Set(existing.map((c) => c.concept.trim().toLowerCase()));
  return related.filter((c) => {
    const k = c.concept.trim().toLowerCase();
    return k.length > 0 && !seen.has(k);
  });
}
