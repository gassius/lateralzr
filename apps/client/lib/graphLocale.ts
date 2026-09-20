import { getActiveLocale, isSupportedLocale, t, type AppLocale } from '@/lib/i18n';

export type LocaleAwareGraphNode = {
  id: number;
  label: string;
  locale?: string;
};

export type LocaleAwareGraphEdge = {
  from: number;
  to: number;
};

export type LocaleAwareGraph = {
  start: { id: number; label: string };
  nodes: LocaleAwareGraphNode[];
  edges: LocaleAwareGraphEdge[];
  meta: { locale?: string; [key: string]: unknown };
};

/**
 * Ensure the graph payload matches the active client locale and drop any
 * nodes that are empty or tagged with a different locale.
 */
export function assertAndFilterGraphLocale<T extends LocaleAwareGraph>(
  data: T,
  expectedLocale: AppLocale = getActiveLocale(),
): T {
  const metaLocale = data.meta?.locale;
  if (
    typeof metaLocale !== 'string' ||
    !isSupportedLocale(metaLocale) ||
    metaLocale !== expectedLocale
  ) {
    throw new Error(t('invalidApiResponse'));
  }

  const nodes = (data.nodes ?? []).filter((node) => {
    if (!node.label?.trim()) return false;
    if (node.locale != null && node.locale !== expectedLocale) return false;
    return true;
  });

  const kept = new Set(nodes.map((node) => node.id));
  const edges = (data.edges ?? []).filter(
    (edge) => kept.has(edge.from) && kept.has(edge.to),
  );

  const start =
    data.start && kept.has(data.start.id)
      ? data.start
      : nodes[0]
        ? { id: nodes[0].id, label: nodes[0].label }
        : data.start;

  return {
    ...data,
    start,
    nodes,
    edges,
    meta: { ...data.meta, locale: expectedLocale },
  };
}
