import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARD_BACK_LINK_MARGIN_TOP,
  CARD_BACK_MEDIA_CONTENT_FIT,
  CARD_BACK_MEDIA_CONTENT_POSITION,
  CARD_BACK_WITHOUT_MEDIA_RHYTHM,
  CARD_BACK_WITH_MEDIA_RHYTHM,
  cardBackScrollContentStyle,
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
  mediaContentFit: null,
  rhythm: CARD_BACK_WITHOUT_MEDIA_RHYTHM,
};

const withMediaReady: CardBackLayout = {
  mode: 'with-media',
  showMediaZone: true,
  showMediaPlaceholder: false,
  showMediaImage: true,
  expandMediaZone: true,
  balanceCopy: false,
  mediaContentFit: 'cover',
  rhythm: CARD_BACK_WITH_MEDIA_RHYTHM,
};

const withMediaLoading: CardBackLayout = {
  mode: 'with-media',
  showMediaZone: true,
  showMediaPlaceholder: true,
  showMediaImage: true,
  expandMediaZone: true,
  balanceCopy: false,
  mediaContentFit: 'cover',
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

test('no-media rhythm centers body copy with guide type and link offset', () => {
  const layout = composeCardBackLayout('absent');
  assert.equal(layout.rhythm.scrollJustify, 'center');
  assert.equal(layout.rhythm.descriptionFontSize, 18);
  assert.equal(layout.rhythm.descriptionLineHeight, 27);
  assert.equal(layout.rhythm.descriptionMarginBottom, 0);
  assert.equal(layout.rhythm.linkMarginTop, CARD_BACK_LINK_MARGIN_TOP);
  assert.ok(layout.rhythm.linkMarginTop >= 20 && layout.rhythm.linkMarginTop <= 24);
});

test('rhythm has no title fields — back starts with description', () => {
  for (const rhythm of [CARD_BACK_WITHOUT_MEDIA_RHYTHM, CARD_BACK_WITH_MEDIA_RHYTHM]) {
    assert.equal('titleFontSize' in rhythm, false);
    assert.equal('titleLineHeight' in rhythm, false);
    assert.equal('titleMarginBottom' in rhythm, false);
  }
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

test('scroll minHeight subtracts face padding (no border) so leftover space is real, not a percent no-op', () => {
  // Default padding 20, border 0 → 480 − 40 = 440 (Lz-24 removed the 1 px teal hairline).
  assert.equal(cardBackScrollMinHeight(480), 440);
  assert.equal(cardBackScrollMinHeight(480, 24), 432);
  assert.equal(cardBackScrollMinHeight(480, 20, 0), 440);
  assert.equal(cardBackScrollMinHeight(40), undefined);
  assert.equal(cardBackScrollMinHeight(0), undefined);
  assert.equal(cardBackScrollMinHeight(-12), undefined);
  assert.equal(cardBackScrollMinHeight(Number.NaN), undefined);
});

test('scroll content style uses measured minHeight so short copy can center under flip', () => {
  assert.deepEqual(cardBackScrollContentStyle(480), {
    flexGrow: 1,
    minHeight: 440,
    justifyContent: 'center',
  });
  assert.deepEqual(cardBackScrollContentStyle(480, 24, 'flex-start'), {
    flexGrow: 1,
    minHeight: 432,
    justifyContent: 'flex-start',
  });
  assert.deepEqual(cardBackScrollContentStyle(0), {
    flexGrow: 1,
    justifyContent: 'center',
  });
  assert.deepEqual(cardBackScrollContentStyle(Number.NaN), {
    flexGrow: 1,
    justifyContent: 'center',
  });
});

test('with-media rhythm is top-stacked body + link so the image keeps leftover height', () => {
  assert.deepEqual(CARD_BACK_WITH_MEDIA_RHYTHM, {
    scrollJustify: 'flex-start',
    descriptionFontSize: 18,
    descriptionLineHeight: 27,
    descriptionMarginBottom: 0,
    linkMarginTop: CARD_BACK_LINK_MARGIN_TOP,
  });
});

test('missing wikiUrl leaves no reserved link gap in the rhythm', () => {
  assert.equal(CARD_BACK_WITHOUT_MEDIA_RHYTHM.descriptionMarginBottom, 0);
  assert.equal(CARD_BACK_WITH_MEDIA_RHYTHM.descriptionMarginBottom, 0);
});

test('ready media cover-fills the expanding well so landscape and portrait do not letterbox on paper', () => {
  const layout = composeCardBackLayout('ready');
  assert.equal(layout.expandMediaZone, true);
  assert.equal(layout.mediaContentFit, 'cover');
  assert.equal(layout.mediaContentFit, CARD_BACK_MEDIA_CONTENT_FIT);
  assert.equal(CARD_BACK_MEDIA_CONTENT_POSITION, 'center');
});

test('no-media and failed media do not invent a fit or a filler well', () => {
  assert.equal(composeCardBackLayout('absent').mediaContentFit, null);
  assert.equal(composeCardBackLayout('failed').mediaContentFit, null);
  assert.equal(composeCardBackLayout('failed').showMediaZone, false);
});
