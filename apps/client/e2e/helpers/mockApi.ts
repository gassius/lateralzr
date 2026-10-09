import fs from 'node:fs';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';

const HERE = __dirname;
const FIXTURES = path.join(HERE, '..', 'fixtures');
const REL = path.join(FIXTURES, 'relationships');
const IMAGES = path.join(FIXTURES, 'images');

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

function pickRelationshipsFixture(body: RelationshipsBody): string {
  const locale = (body.locale ?? 'en').toLowerCase();
  const start = (body.start ?? '').trim();
  const canonical = (body.canonicalStart ?? '').trim();
  const startKey = start.toLowerCase();
  const canonicalKey = canonical.toLowerCase();

  if (startKey === '__empty__' || canonicalKey === '__empty__') {
    return readJson('empty-batch.json');
  }

  if (
    startKey === 'psychedelics' ||
    startKey === 'psicodélicos' ||
    startKey === 'psicodelicos'
  ) {
    return readJson(locale === 'es' ? 'psychedelics-photo-es.json' : 'psychedelics-photo-en.json');
  }

  if (canonicalKey === 'long-label' || startKey === 'long-label') {
    return readJson('long-label-en.json');
  }

  if (
    canonicalKey === 'mushroom' ||
    startKey === 'mushroom' ||
    startKey === 'seta'
  ) {
    return readJson(locale === 'es' ? 'mushroom-es.json' : 'mushroom-en.json');
  }

  // Cold-start / unknown: still return a deterministic short-label deck.
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

async function fulfillRelationships(route: Route): Promise<void> {
  let body: RelationshipsBody = {};
  try {
    body = (route.request().postDataJSON() as RelationshipsBody) ?? {};
  } catch {
    body = {};
  }
  const payload = pickRelationshipsFixture(body);
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: payload,
  });
}

async function fulfillMedia(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const target = url.searchParams.get('url');
  const bytes = imageForMediaUrl(target);
  await route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: bytes,
  });
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
export async function installApiMocks(page: Page): Promise<void> {
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

  await page.route('**/api/concepts/relationships', fulfillRelationships);
  await page.route('**/api/media**', fulfillMedia);
}
