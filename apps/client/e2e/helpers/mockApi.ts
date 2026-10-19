import fs from 'node:fs';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';

const HERE = __dirname;
const FIXTURES = path.join(HERE, '..', 'fixtures');
const REL = path.join(FIXTURES, 'relationships');
const IMAGES = path.join(FIXTURES, 'images');

export type MockOptions = {
  /** Exercise missing/disabled reference independently of image attribution. */
  omitWikipedia?: boolean;
  /** Match today’s API payload, which returns url/kind/license only. */
  licenseOnlyMedia?: boolean;
  /** Hold load-more / subsequent relationship calls open this long (Node timer). */
  delayLoadMoreMs?: number;
  /** Hold the first relationships call open this long (intro / logo capture). */
  delayFirstMs?: number;
  /** Serve a 404 from `/api/media` so the card falls back to the no-media back. */
  brokenMedia?: boolean;
  /**
   * Lz-57 no-match: 404 this laterality on relationships POSTs.
   * Opt-in so `?laterality=4` first loads (laterality-sheet / axe) still get a deck.
   */
  lateralityNoMatch?: number;
};

type RelationshipsBody = {
  start?: string;
  canonicalStart?: string;
  onlyWithMedia?: boolean;
  locale?: string;
  laterality?: number;
  complexity?: number;
};

function readJson(name: string): string {
  return fs.readFileSync(path.join(REL, name), 'utf8');
}

function gradeFiveFixture(body: RelationshipsBody): string {
  const locale = (body.locale ?? 'en').toLowerCase();
  const raw = readJson(locale === 'es' ? 'mushroom-grade-5-es.json' : 'mushroom-grade-5-en.json');
  const graph = JSON.parse(raw) as {
    data: { start: { id: number; label: string }; nodes: Array<{ id: number; label: string }> };
  };
  const startKey = (body.start ?? '').trim().toLowerCase();
  const node = graph.data.nodes.find((n) => n.label.toLowerCase() === startKey);
  if (node) {
    graph.data.start = { id: node.id, label: node.label };
  }
  return JSON.stringify(graph);
}

function pickRelationshipsFixture(body: RelationshipsBody, callIndex: number): string {
  if (body.laterality === 5) {
    const startKey = (body.start ?? '').trim().toLowerCase();
    const canonicalKey = (body.canonicalStart ?? '').trim().toLowerCase();
    if (
      startKey === 'mushroom' ||
      startKey === 'mycelium' ||
      startKey === 'spore' ||
      startKey === 'seta' ||
      startKey === 'micelio' ||
      canonicalKey === 'mushroom'
    ) {
      return gradeFiveFixture(body);
    }
  }
  const locale = (body.locale ?? 'en').toLowerCase();
  const start = (body.start ?? '').trim();
  const canonical = (body.canonicalStart ?? '').trim();
  const startKey = start.toLowerCase();
  const canonicalKey = canonical.toLowerCase();

  if (
    canonicalKey === 'loading-deck-two' ||
    startKey === 'loading-deck-two' ||
    startKey === 'meridian'
  ) {
    // Two-card deck so Lz-36 back-from-loading can assert N>0 (not N-1).
    // `meridian` is the second card; later calls are the delayed load-more payload.
    const deck =
      callIndex <= 1 ? 'loading-deck-two-en.json' : 'loading-more-en.json';
    return readJson(deck);
  }

  if (
    canonicalKey === 'loading-deck' ||
    startKey === 'loading-deck' ||
    startKey === 'horizon' ||
    startKey === 'horizonte'
  ) {
    // First call: single card. Later calls: load-more payload (may be delayed by caller).
    const deck =
      locale === 'es'
        ? callIndex <= 1
          ? 'loading-deck-es.json'
          : 'loading-more-es.json'
        : callIndex <= 1
          ? 'loading-deck-en.json'
          : 'loading-more-en.json';
    return readJson(deck);
  }

  if (
    startKey === 'psychedelics' ||
    startKey === 'psicodélicos' ||
    startKey === 'psicodelicos'
  ) {
    return readJson(locale === 'es' ? 'psychedelics-photo-es.json' : 'psychedelics-photo-en.json');
  }

  if (
    canonicalKey === 'diagram' ||
    startKey === 'diagram' ||
    startKey === 'schematic lattice'
  ) {
    return readJson('diagram-en.json');
  }

  if (
    canonicalKey === 'transparent' ||
    startKey === 'transparent' ||
    startKey === 'amber cutout'
  ) {
    return readJson('transparent-en.json');
  }

  if (canonicalKey === 'long-label' || startKey === 'long-label') {
    return readJson(locale === 'es' ? 'long-label-es.json' : 'long-label-en.json');
  }

  // Lz-26 art-director test strings (guide §7.3).
  if (canonicalKey === 'tide' || startKey === 'tide') {
    return readJson('tide-en.json');
  }
  if (
    canonicalKey === 'collective-intelligence' ||
    startKey === 'collective intelligence'
  ) {
    return readJson('collective-intelligence-en.json');
  }
  if (
    canonicalKey === 'intergenerational' ||
    startKey === 'intergenerational transmission of knowledge'
  ) {
    return readJson('intergenerational-en.json');
  }

  if (canonicalKey === 'long-description' || startKey === 'long-description') {
    return readJson('long-description-en.json');
  }

  if (
    canonicalKey === 'no-description' ||
    startKey === 'no-description' ||
    startKey === 'untitled' ||
    startKey === 'sin título' ||
    startKey === 'sin titulo'
  ) {
    return readJson(locale === 'es' ? 'no-description-es.json' : 'no-description-en.json');
  }

  if (
    canonicalKey === 'mushroom' ||
    startKey === 'mushroom' ||
    startKey === 'seta'
  ) {
    return readJson(locale === 'es' ? 'mushroom-es.json' : 'mushroom-en.json');
  }

  return readJson(locale === 'es' ? 'mushroom-es.json' : 'mushroom-en.json');
}

function imageForMediaUrl(target: string | null): { body: Buffer; contentType: string } {
  const value = (target ?? '').toLowerCase();
  if (value.includes('diagram')) {
    return {
      body: fs.readFileSync(path.join(IMAGES, 'diagram.png')),
      contentType: 'image/png',
    };
  }
  if (value.includes('transparent')) {
    return {
      body: fs.readFileSync(path.join(IMAGES, 'transparent.png')),
      contentType: 'image/png',
    };
  }
  // Adequate-resolution JPEG so the Lz-28 cover path is exercised (≤1.5× upscale).
  return {
    body: fs.readFileSync(path.join(IMAGES, 'photo.jpg')),
    contentType: 'image/jpeg',
  };
}

function isLocalAsset(url: string): boolean {
  return (
    url.includes('127.0.0.1') ||
    url.includes('localhost') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

/**
 * Mock concept API + media proxy. Abort stray third-party calls so captures stay offline.
 * Specific API routes are registered last so Playwright checks them first.
 */
export async function installApiMocks(page: Page, options: MockOptions = {}): Promise<void> {
  let relationshipsCalls = 0;
  const delayLoadMoreMs = options.delayLoadMoreMs ?? 0;
  const delayFirstMs = options.delayFirstMs ?? 0;

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/concepts/relationships') || url.includes('/api/media')) {
      await route.fallback();
      return;
    }
    if (isLocalAsset(url)) {
      await route.continue();
      return;
    }
    await route.abort();
  });

  await page.route('**/api/concepts/relationships', async (route: Route) => {
    relationshipsCalls += 1;
    let body: RelationshipsBody = {};
    try {
      body = (route.request().postDataJSON() as RelationshipsBody) ?? {};
    } catch {
      body = {};
    }

    const startKey = (body.start ?? '').trim().toLowerCase();
    const canonicalKey = (body.canonicalStart ?? '').trim().toLowerCase();
    const isLoadingDeck =
      canonicalKey === 'loading-deck' ||
      canonicalKey === 'loading-deck-two' ||
      startKey === 'loading-deck' ||
      startKey === 'loading-deck-two' ||
      startKey === 'horizon' ||
      startKey === 'horizonte' ||
      startKey === 'meridian';

    if (
      options.lateralityNoMatch != null &&
      body.laterality === options.lateralityNoMatch
    ) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'No matching neighborhood',
          status: 'error',
        }),
      });
      return;
    }

    if (relationshipsCalls === 1 && delayFirstMs > 0) {
      await new Promise((r) => setTimeout(r, delayFirstMs));
    }

    // Delay 2nd+ calls for the loading-deck journey (prefetch / swipe load-more).
    if (isLoadingDeck && relationshipsCalls > 1 && delayLoadMoreMs > 0) {
      await new Promise((r) => setTimeout(r, delayLoadMoreMs));
    }

    let payload = pickRelationshipsFixture(body, relationshipsCalls);
    if (options.omitWikipedia || options.licenseOnlyMedia || options.brokenMedia) {
      const graph = JSON.parse(payload);
      for (const node of graph.data.nodes) {
        if (options.omitWikipedia) node.wikiUrl = null;
        if (options.brokenMedia && node.mediaUrl) {
          const broken = 'https://upload.wikimedia.org/wikipedia/commons/e2e/fixture-broken.jpg';
          node.mediaUrl = broken;
          node.media = (node.media ?? []).map((entry: { url: string }) =>
            entry.url ? { ...entry, url: broken } : entry,
          );
        }
        if (options.licenseOnlyMedia) {
          node.media = node.media.map(
            ({ url, kind, license }: { url: string; kind: string; license: string }) =>
              ({ url, kind, license }),
          );
        }
      }
      payload = JSON.stringify(graph);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: payload,
    });
  });

  await page.route('**/api/media**', async (route: Route) => {
    const reqUrl = new URL(route.request().url());
    const target = reqUrl.searchParams.get('url') ?? '';
    if (options.brokenMedia || target.includes('fixture-broken')) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
      return;
    }
    const image = imageForMediaUrl(target);
    await route.fulfill({
      status: 200,
      contentType: image.contentType,
      body: image.body,
    });
  });
}
