import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyJourneyTestDeck,
  buildRelationshipsRequestBody,
  journeyStartOptions,
  parseJourneyTestParams,
  resolveInitialComplexity,
  resolveJourneyStartFallback,
} from './testQueryParams.ts';

describe('parseJourneyTestParams', () => {
  it('returns empty overrides when the query string is missing or blank', () => {
    assert.deepEqual(parseJourneyTestParams(null), {
      localizedConcept: undefined,
      canonicalConcept: undefined,
      onlyWithMedia: false,
    });
    assert.deepEqual(parseJourneyTestParams(''), {
      localizedConcept: undefined,
      canonicalConcept: undefined,
      onlyWithMedia: false,
    });
    assert.deepEqual(parseJourneyTestParams('???'), {
      localizedConcept: undefined,
      canonicalConcept: undefined,
      onlyWithMedia: false,
    });
  });

  it('reads a valid integer complexity and ignores blank or invalid values', () => {
    assert.equal(parseJourneyTestParams('complexity=5').complexity, 5);
    assert.equal(parseJourneyTestParams('complexity=1').complexity, 1);
    assert.equal(parseJourneyTestParams('complexity=05').complexity, 5);
    assert.equal(parseJourneyTestParams('complexity=').complexity, undefined);
    assert.equal(parseJourneyTestParams('complexity=%20').complexity, undefined);
    assert.equal(parseJourneyTestParams('complexity=abc').complexity, undefined);
    assert.equal(parseJourneyTestParams('complexity=5.5').complexity, undefined);
    assert.equal(parseJourneyTestParams('complexity=0').complexity, undefined);
    assert.equal(parseJourneyTestParams('complexity=6').complexity, undefined);
    assert.equal(parseJourneyTestParams('canonicalConcept=mushroom').complexity, undefined);
  });

  it('reads canonicalConcept, localizedConcept, and onlyWithMedia=true', () => {
    const parsed = parseJourneyTestParams(
      'canonicalConcept=creativity&localizedConcept=creatividad&onlyWithMedia=true&locale=es',
    );
    assert.equal(parsed.canonicalConcept, 'creativity');
    assert.equal(parsed.localizedConcept, 'creatividad');
    assert.equal(parsed.onlyWithMedia, true);
  });

  it('treats blank or whitespace-only concept values as missing', () => {
    const parsed = parseJourneyTestParams('canonicalConcept=%20%20&localizedConcept=');
    assert.equal(parsed.canonicalConcept, undefined);
    assert.equal(parsed.localizedConcept, undefined);
    assert.equal(parsed.onlyWithMedia, false);
  });

  it('accepts true/1/yes for onlyWithMedia and ignores other values', () => {
    assert.equal(parseJourneyTestParams('onlyWithMedia=true').onlyWithMedia, true);
    assert.equal(parseJourneyTestParams('onlyWithMedia=TRUE').onlyWithMedia, true);
    assert.equal(parseJourneyTestParams('onlyWithMedia=1').onlyWithMedia, true);
    assert.equal(parseJourneyTestParams('onlyWithMedia=yes').onlyWithMedia, true);
    assert.equal(parseJourneyTestParams('onlyWithMedia=false').onlyWithMedia, false);
    assert.equal(parseJourneyTestParams('onlyWithMedia=0').onlyWithMedia, false);
    assert.equal(parseJourneyTestParams('onlyWithMedia=nope').onlyWithMedia, false);
  });

  it('does not throw on malformed query strings', () => {
    assert.doesNotThrow(() => parseJourneyTestParams('%E0%A4%A'));
  });
});

describe('journeyStartOptions', () => {
  it('prefers localizedConcept over canonicalConcept when both are set', () => {
    assert.deepEqual(
      journeyStartOptions({
        localizedConcept: 'creatividad',
        canonicalConcept: 'creativity',
        onlyWithMedia: false,
      }),
      { start: 'creatividad' },
    );
  });

  it('maps canonicalConcept to canonicalStart', () => {
    assert.deepEqual(
      journeyStartOptions({
        localizedConcept: undefined,
        canonicalConcept: 'creativity',
        onlyWithMedia: true,
      }),
      { start: 'creativity', canonicalStart: 'creativity', onlyWithMedia: true },
    );
  });

  it('sends onlyWithMedia alone for a media-filtered cold start', () => {
    assert.deepEqual(
      journeyStartOptions({
        localizedConcept: undefined,
        canonicalConcept: undefined,
        onlyWithMedia: true,
      }),
      { onlyWithMedia: true },
    );
  });
});

describe('buildRelationshipsRequestBody', () => {
  it('includes start, canonicalStart, onlyWithMedia, and locale', () => {
    assert.deepEqual(
      buildRelationshipsRequestBody({
        start: '  creatividad ',
        canonicalStart: 'creativity',
        onlyWithMedia: true,
        locale: 'es',
        limit: 12,
        depth: 2,
      }),
      {
        start: 'creatividad',
        canonicalStart: 'creativity',
        onlyWithMedia: true,
        locale: 'es',
        limit: 12,
        depth: 2,
      },
    );
  });

  it('omits empty start values and onlyWithMedia=false', () => {
    const body = buildRelationshipsRequestBody({
      start: '   ',
      onlyWithMedia: false,
      locale: 'en',
    });
    assert.equal('start' in body, false);
    assert.equal('canonicalStart' in body, false);
    assert.equal('onlyWithMedia' in body, false);
    assert.equal(body.locale, 'en');
  });

  it('includes a valid complexity integer and omits invalid values', () => {
    assert.equal(
      buildRelationshipsRequestBody({ complexity: 5, locale: 'en' }).complexity,
      5,
    );
    const omitted = buildRelationshipsRequestBody({ locale: 'en' });
    assert.equal('complexity' in omitted, false);
  });
});

describe('resolveInitialComplexity', () => {
  it('prefers a valid URL complexity over the stored value', () => {
    assert.equal(resolveInitialComplexity({ onlyWithMedia: false, complexity: 5 }, 2), 5);
  });

  it('falls back to the stored complexity when the URL value is missing', () => {
    assert.equal(resolveInitialComplexity({ onlyWithMedia: false }, 3), 3);
  });
});

describe('applyJourneyTestDeck', () => {
  const items = [
    { concept: 'tide', shortDescription: '', wikiUrl: null, mediaUrl: null },
    { concept: 'mushroom', shortDescription: '', wikiUrl: null, mediaUrl: 'https://example.com/m.jpg' },
    { concept: 'lighthouse', shortDescription: '', wikiUrl: null, mediaUrl: 'https://example.com/l.jpg' },
  ];

  it('moves a localized start concept to the front', () => {
    const deck = applyJourneyTestDeck(items, {
      localizedConcept: 'Mushroom',
      canonicalConcept: undefined,
      onlyWithMedia: false,
    });
    assert.deepEqual(
      deck.map((c) => c.concept),
      ['mushroom', 'tide', 'lighthouse'],
    );
  });

  it('drops concepts without media when onlyWithMedia is set', () => {
    const deck = applyJourneyTestDeck(items, {
      localizedConcept: undefined,
      canonicalConcept: undefined,
      onlyWithMedia: true,
    });
    assert.deepEqual(
      deck.map((c) => c.concept),
      ['mushroom', 'lighthouse'],
    );
  });

  it('keeps the original order when the start label is missing', () => {
    const deck = applyJourneyTestDeck(items, {
      localizedConcept: 'no-such-concept',
      canonicalConcept: undefined,
      onlyWithMedia: false,
    });
    assert.deepEqual(
      deck.map((c) => c.concept),
      ['tide', 'mushroom', 'lighthouse'],
    );
  });
});

describe('resolveJourneyStartFallback', () => {
  it('falls back to a cold start when a named start 404s', () => {
    const fallback = resolveJourneyStartFallback(
      { localizedConcept: 'missing', canonicalConcept: undefined, onlyWithMedia: true },
      { status: 404 },
    );
    assert.deepEqual(fallback, { onlyWithMedia: true });
  });

  it('does not swallow errors when there was no named start', () => {
    assert.equal(
      resolveJourneyStartFallback(
        { localizedConcept: undefined, canonicalConcept: undefined, onlyWithMedia: true },
        { status: 404 },
      ),
      null,
    );
  });

  it('does not swallow non-404 failures', () => {
    assert.equal(
      resolveJourneyStartFallback(
        { localizedConcept: 'creativity', canonicalConcept: undefined, onlyWithMedia: false },
        { status: 500 },
      ),
      null,
    );
  });
});
