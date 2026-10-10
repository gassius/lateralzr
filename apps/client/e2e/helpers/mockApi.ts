import fs from 'node:fs';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';

const HERE = __dirname;
const FIXTURES = path.join(HERE, '..', 'fixtures');
const REL = path.join(FIXTURES, 'relationships');
const IMAGES = path.join(FIXTURES, 'images');

export type MockOptions = {
  /** Hold load-more / subsequent relationship calls open this long (Node timer). */
  delayLoadMoreMs?: number;
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

function pickRelationshipsFixture(body: RelationshipsBody, callIndex: number): string {
  const locale = (body.locale ?? 'en').toLowerCase();
  const start = (body.start ?? '').trim();
  const canonical = (body.canonicalStart ?? '').trim();
  const startKey = start.toLowerCase();
  const canonicalKey = canonical.toLowerCase();

  if (canonicalKey === 'loading-deck' || startKey === 'loading-deck' || startKey === 'horizon') {
    // First call: single card. Later calls: load-more payload (may be delayed by caller).
    return readJson(callIndex <= 1 ? 'loading-deck-en.json' : 'loading-more-en.json');
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

  if (
    canonicalKey === 'mushroom' ||
    startKey === 'mushroom' ||
    startKey === 'seta'
  ) {
    return readJson(locale === 'es' ? 'mushroom-es.json' : 'mushroom-en.json');
  }

  return readJson(locale === 'es' ? 'mushroom-es.json' : 'mushroom-en.json');
}

function imageForMediaUrl(target: string | null): Buffer {
  const value = (target ?? '').toLowerCase();
  if (value.includes('diagram')) {
    return fs.readFileSync(path.join(IMAGES, 'diagram.png'));
  }
  if (value.includes('transparent')) {
    return fs.readFileSync(path.join(IMAGES, 'transparent.png'));
  }
  return fs.readFileSync(path.join(IMAGES, 'photo.png'));
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
      startKey === 'loading-deck' ||
      startKey === 'horizon';

    // Delay 2nd+ calls for the loading-deck journey (prefetch / swipe load-more).
    if (isLoadingDeck && relationshipsCalls > 1 && delayLoadMoreMs > 0) {
      await new Promise((r) => setTimeout(r, delayLoadMoreMs));
    }

    const payload = pickRelationshipsFixture(body, relationshipsCalls);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: payload,
    });
  });

  await page.route('**/api/media**', async (route: Route) => {
    const url = new URL(route.request().url());
    const target = url.searchParams.get('url');
    const bytes = imageForMediaUrl(target);
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: bytes,
    });
  });
}
