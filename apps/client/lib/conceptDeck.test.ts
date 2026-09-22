import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyAppendedBatch,
  applyComplexityTreeSwap,
  graphToDeckItems,
  mergeUniqueRelated,
  planLoadMoreMerge,
  type DeckConcept,
  type DeckGraph,
} from './conceptDeck';

function item(concept: string): DeckConcept {
  return {
    concept,
    shortDescription: `${concept} desc`,
    wikiUrl: null,
    mediaUrl: null,
  };
}

/** Production-shaped payload: start sits last in `nodes` (DB order), not first. */
function mushroomGraph(): DeckGraph {
  return {
    start: { id: 147, label: 'mushroom' },
    nodes: [
      { id: 15, label: 'tide', shortDescription: '', wikiUrl: null, mediaUrl: null },
      { id: 20, label: 'lighthouse', shortDescription: '', wikiUrl: null, mediaUrl: null },
      { id: 147, label: 'mushroom', shortDescription: '', wikiUrl: null, mediaUrl: null },
    ],
    edges: [
      { from: 147, to: 15 },
      { from: 15, to: 20 },
    ],
  };
}

test('mergeUniqueRelated skips blank and already-seen names (case-insensitive)', () => {
  const existing = [item('Mushroom'), item('Tide')];
  const related = [item('mushroom'), item('  '), item('Lighthouse'), item('tide')];
  assert.deepEqual(
    mergeUniqueRelated(existing, related).map((c) => c.concept),
    ['Lighthouse'],
  );
});

test('graphToDeckItems walks from start so the last card is a frontier node', () => {
  const deck = graphToDeckItems(mushroomGraph());
  assert.equal(deck[0]?.concept, 'mushroom');
  assert.equal(deck[deck.length - 1]?.concept, 'lighthouse');
  assert.deepEqual(
    deck.map((c) => c.concept),
    ['mushroom', 'tide', 'lighthouse'],
  );
});

test('graphToDeckItems is empty-safe when nodes are missing', () => {
  assert.deepEqual(graphToDeckItems({}), []);
  assert.deepEqual(graphToDeckItems({ nodes: null, edges: null }), []);
});

test('seeded load-more of the same neighborhood plans a cold start instead of retrying the seed', () => {
  const existing = graphToDeckItems(mushroomGraph());
  const incoming = graphToDeckItems(mushroomGraph());
  assert.deepEqual(planLoadMoreMerge(existing, incoming, true), { action: 'coldStart' });
});

test('unordered last-node seed (the original start) has no unique cards', () => {
  const nodes = mushroomGraph().nodes ?? [];
  const unorderedLast = item(nodes[nodes.length - 1]!.label);
  assert.equal(unorderedLast.concept, 'mushroom');
  const existing = nodes.map((n) => item(n.label));
  const secondBatch = nodes.map((n) => item(n.label));
  assert.equal(mergeUniqueRelated(existing, secondBatch).length, 0);
  assert.equal(planLoadMoreMerge(existing, [unorderedLast, ...secondBatch], true).action, 'coldStart');
});

test('fresh cards from a frontier seed are appended', () => {
  const existing = graphToDeckItems(mushroomGraph());
  const incoming = [item('algorithm'), item('Dunes'), item('tide')];
  const plan = planLoadMoreMerge(existing, incoming, true);
  assert.equal(plan.action, 'append');
  if (plan.action === 'append') {
    assert.deepEqual(
      plan.add.map((c) => c.concept),
      ['algorithm', 'Dunes'],
    );
  }
});

test('cold start that is still all duplicates plans an empty retry', () => {
  const existing = [item('mushroom'), item('tide')];
  const incoming = [item('Mushroom'), item('TIDE')];
  assert.deepEqual(planLoadMoreMerge(existing, incoming, false), { action: 'retryEmpty' });
});

test('applyAppendedBatch advances off the logo onto the first new card', () => {
  const existing = [item('mushroom'), item('tide')];
  const add = [item('algorithm'), item('Dunes')];
  const applied = applyAppendedBatch(existing, add, true);
  assert.equal(applied.pendingEndDeckLoad, false);
  assert.equal(applied.nextIndex, 2);
  assert.equal(applied.concepts[applied.nextIndex!]?.concept, 'algorithm');
  assert.equal(applied.concepts.length, 4);
});

test('applyAppendedBatch does not jump index during silent prefetch', () => {
  const existing = [item('mushroom')];
  const applied = applyAppendedBatch(existing, [item('tide')], false);
  assert.equal(applied.nextIndex, null);
  assert.equal(applied.pendingEndDeckLoad, false);
  assert.equal(applied.concepts.length, 2);
});

test('applyAppendedBatch keeps the pending logo when nothing new arrived', () => {
  const existing = [item('mushroom')];
  const applied = applyAppendedBatch(existing, [], true);
  assert.equal(applied.pendingEndDeckLoad, true);
  assert.equal(applied.nextIndex, null);
  assert.equal(applied.concepts, existing);
});

test('applyComplexityTreeSwap keeps the current card and replaces upcoming cards', () => {
  const existing = [item('mushroom'), item('tide'), item('lighthouse'), item('dunes')];
  const incoming = [item('tide'), item('algorithm'), item('constraint')];
  const swapped = applyComplexityTreeSwap(existing, 1, incoming);

  assert.equal(swapped.currentIndex, 1);
  assert.deepEqual(
    swapped.concepts.map((c) => c.concept),
    ['mushroom', 'tide', 'algorithm', 'constraint'],
  );
  assert.equal(swapped.clearedEndDeckLoad, true);
});

test('applyComplexityTreeSwap keeps the current card when the new tree is a cold start', () => {
  const existing = [item('mushroom'), item('tide')];
  const incoming = [item('orbit'), item('silence')];
  const swapped = applyComplexityTreeSwap(existing, 1, incoming);

  assert.equal(swapped.currentIndex, 1);
  assert.deepEqual(
    swapped.concepts.map((c) => c.concept),
    ['mushroom', 'tide', 'orbit', 'silence'],
  );
});

test('applyComplexityTreeSwap is a no-op when the incoming tree is empty', () => {
  const existing = [item('mushroom'), item('tide')];
  const swapped = applyComplexityTreeSwap(existing, 0, []);
  assert.equal(swapped.currentIndex, 0);
  assert.deepEqual(swapped.concepts, existing);
  assert.equal(swapped.clearedEndDeckLoad, false);
});
