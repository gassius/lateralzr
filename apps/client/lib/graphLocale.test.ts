import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertAndFilterGraphLocale, type LocaleAwareGraph } from './graphLocale.ts';
import { setActiveLocale } from './i18n.ts';

function sampleGraph(overrides?: Partial<LocaleAwareGraph>): LocaleAwareGraph {
  return {
    start: { id: 1, label: 'creativity' },
    nodes: [
      { id: 1, label: 'creativity', locale: 'en' },
      { id: 2, label: 'constraint', locale: 'en' },
    ],
    edges: [{ from: 1, to: 2 }],
    meta: { depth: 2, limit: 12, minStrength: 0, hasMore: false, locale: 'en' },
    ...overrides,
  };
}

describe('assertAndFilterGraphLocale', () => {
  it('keeps nodes that match the expected locale', () => {
    setActiveLocale('en');
    const filtered = assertAndFilterGraphLocale(sampleGraph(), 'en');
    assert.equal(filtered.nodes.length, 2);
    assert.equal(filtered.meta.locale, 'en');
  });

  it('rejects when meta.locale does not match the active locale', () => {
    setActiveLocale('en');
    assert.throws(() =>
      assertAndFilterGraphLocale(
        sampleGraph({ meta: { depth: 2, limit: 12, minStrength: 0, hasMore: false, locale: 'es' } }),
        'en',
      ),
    );
  });

  it('drops nodes tagged with a different locale and their edges', () => {
    setActiveLocale('en');
    const filtered = assertAndFilterGraphLocale(
      sampleGraph({
        nodes: [
          { id: 1, label: 'creativity', locale: 'en' },
          { id: 2, label: 'restricción', locale: 'es' },
        ],
      }),
      'en',
    );
    assert.deepEqual(
      filtered.nodes.map((n) => n.id),
      [1],
    );
    assert.equal(filtered.edges.length, 0);
  });

  it('drops nodes with empty labels', () => {
    setActiveLocale('en');
    const filtered = assertAndFilterGraphLocale(
      sampleGraph({
        nodes: [
          { id: 1, label: 'creativity', locale: 'en' },
          { id: 2, label: '   ', locale: 'en' },
        ],
      }),
      'en',
    );
    assert.equal(filtered.nodes.length, 1);
    assert.equal(filtered.edges.length, 0);
  });
});
