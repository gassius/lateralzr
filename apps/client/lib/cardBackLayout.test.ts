import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARD_BACK_WITHOUT_MEDIA_RHYTHM,
  CARD_BACK_WITH_MEDIA_RHYTHM,
  cardBackBalancedColumnStyle,
  cardBackScrollMinHeight,
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
  rhythm: CARD_BACK_WITHOUT_MEDIA_RHYTHM,
};

const withMediaReady: CardBackLayout = {
  mode: 'with-media',
  showMediaZone: true,
  showMediaPlaceholder: false,
  showMediaImage: true,
  expandMediaZone: true,
  balanceCopy: false,
  rhythm: CARD_BACK_WITH_MEDIA_RHYTHM,
};

const withMediaLoading: CardBackLayout = {
  mode: 'with-media',
  showMediaZone: true,
  showMediaPlaceholder: true,
  showMediaImage: true,
  expandMediaZone: true,
  balanceCopy: false,
  rhythm: CARD_BACK_WITH_MEDIA_RHYTHM,
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

test('no-media copy is a centered group with more open type than the media-forward stack', () => {
  const layout = composeCardBackLayout('absent');
  assert.equal(layout.rhythm.scrollJustify, 'center');
  assert.equal(layout.rhythm.titleFontSize, 40);
  assert.equal(layout.rhythm.descriptionFontSize, 20);
  assert.ok(layout.rhythm.titleFontSize > CARD_BACK_WITH_MEDIA_RHYTHM.titleFontSize);
  assert.ok(layout.rhythm.titleMarginBottom > CARD_BACK_WITH_MEDIA_RHYTHM.titleMarginBottom);
  assert.ok(layout.rhythm.descriptionMarginBottom > CARD_BACK_WITH_MEDIA_RHYTHM.descriptionMarginBottom);
  assert.ok(layout.rhythm.descriptionLineHeight > CARD_BACK_WITH_MEDIA_RHYTHM.descriptionLineHeight);
});

test('ready media uses a prominent media zone with copy stacked, not balanced as if empty', () => {
  assert.equal(
    resolveCardBackMediaPhase({ hasMediaUrl: true, decoded: true, failed: false }),
    'ready',
  );
  assert.deepEqual(composeCardBackLayout('ready'), withMediaReady);
  assert.equal(composeCardBackLayout('ready').rhythm.scrollJustify, 'flex-start');
  assert.equal(composeCardBackLayout('ready').rhythm, CARD_BACK_WITH_MEDIA_RHYTHM);
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
  assert.equal(layout.rhythm.scrollJustify, 'center');
});

test('scroll minHeight subtracts face padding and border so leftover space is real, not a percent no-op', () => {
  assert.equal(cardBackScrollMinHeight(480), 438);
  assert.equal(cardBackScrollMinHeight(40), undefined);
  assert.equal(cardBackScrollMinHeight(0), undefined);
  assert.equal(cardBackScrollMinHeight(-12), undefined);
  assert.equal(cardBackScrollMinHeight(Number.NaN), undefined);
});

test('no-media column uses a pixel height so justifyContent can actually center the copy group', () => {
  assert.deepEqual(cardBackBalancedColumnStyle(480), {
    height: 438,
    justifyContent: 'center',
  });
  assert.deepEqual(cardBackBalancedColumnStyle(0), {
    justifyContent: 'center',
  });
  assert.deepEqual(cardBackBalancedColumnStyle(Number.NaN), {
    justifyContent: 'center',
  });
});

test('with-media rhythm stays compact and top-stacked so the image keeps leftover height', () => {
  assert.deepEqual(CARD_BACK_WITH_MEDIA_RHYTHM, {
    scrollJustify: 'flex-start',
    titleFontSize: 26,
    titleLineHeight: 32,
    titleMarginBottom: 8,
    descriptionFontSize: 16,
    descriptionLineHeight: 24,
    descriptionMarginBottom: 12,
    linkMarginTop: 0,
  });
});
