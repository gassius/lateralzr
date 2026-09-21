import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composeCardBackLayout,
  resolveCardBackMediaPhase,
  type CardBackLayout,
} from './cardBackLayout';

const withoutMedia: CardBackLayout = {
  mode: 'without-media',
  showMediaZone: false,
  showMediaPlaceholder: false,
  showMediaImage: false,
  expandMediaZone: false,
  balanceCopy: true,
};

const withMediaReady: CardBackLayout = {
  mode: 'with-media',
  showMediaZone: true,
  showMediaPlaceholder: false,
  showMediaImage: true,
  expandMediaZone: true,
  balanceCopy: false,
};

const withMediaLoading: CardBackLayout = {
  mode: 'with-media',
  showMediaZone: true,
  showMediaPlaceholder: true,
  showMediaImage: true,
  expandMediaZone: true,
  balanceCopy: false,
};

test('absent media uses the without-media layout and collapses the media zone', () => {
  assert.equal(
    resolveCardBackMediaPhase({ hasMediaUrl: false, decoded: false, failed: false }),
    'absent',
  );
  assert.deepEqual(composeCardBackLayout('absent'), withoutMedia);
});

test('Tide-style copy is balanced instead of stretched over an empty media hole', () => {
  const layout = composeCardBackLayout('absent');
  assert.equal(layout.showMediaZone, false);
  assert.equal(layout.balanceCopy, true);
  assert.equal(layout.expandMediaZone, false);
});

test('ready media uses a prominent media zone with copy stacked, not balanced as if empty', () => {
  assert.equal(
    resolveCardBackMediaPhase({ hasMediaUrl: true, decoded: true, failed: false }),
    'ready',
  );
  assert.deepEqual(composeCardBackLayout('ready'), withMediaReady);
});

test('loading media keeps the with-media layout and a calm placeholder, not a broken box', () => {
  assert.equal(
    resolveCardBackMediaPhase({ hasMediaUrl: true, decoded: false, failed: false }),
    'loading',
  );
  assert.deepEqual(composeCardBackLayout('loading'), withMediaLoading);
});

test('failed media load degrades to the same layout as a concept without media', () => {
  assert.equal(
    resolveCardBackMediaPhase({ hasMediaUrl: true, decoded: false, failed: true }),
    'failed',
  );
  assert.equal(
    resolveCardBackMediaPhase({ hasMediaUrl: true, decoded: true, failed: true }),
    'failed',
  );
  assert.deepEqual(composeCardBackLayout('failed'), withoutMedia);
  assert.deepEqual(composeCardBackLayout('failed'), composeCardBackLayout('absent'));
});

test('failure wins over a decoded flag so a broken-image box cannot linger', () => {
  const phase = resolveCardBackMediaPhase({ hasMediaUrl: true, decoded: true, failed: true });
  const layout = composeCardBackLayout(phase);
  assert.equal(layout.showMediaZone, false);
  assert.equal(layout.showMediaImage, false);
  assert.equal(layout.showMediaPlaceholder, false);
});
