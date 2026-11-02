import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConceptItem } from '@/lib/api';
import { nearbyCardMediaUrls } from './conceptMediaPrefetch.ts';

function item(key: string, mediaUrl: string | null): ConceptItem {
  return {
    concept: key,
    shortDescription: key,
    wikiUrl: null,
    mediaUrl,
    media: mediaUrl ? [{ url: mediaUrl, kind: 'image' }] : [],
  };
}

const opts = { platform: 'ios', apiBaseUrl: 'https://api.example' };

describe('nearbyCardMediaUrls', () => {
  it('returns display-sized urls for current + next 1–2 only', () => {
    const concepts = [
      item('a', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/A.jpg/960px-A.jpg'),
      item('b', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/B.jpg/960px-B.jpg'),
      item('c', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/C.jpg/960px-C.jpg'),
      item('d', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/D.jpg/960px-D.jpg'),
    ];
    const urls = nearbyCardMediaUrls(concepts, 0, 640, opts);
    assert.equal(urls.length, 3);
    assert.ok(urls.every((u) => u.includes('upload.wikimedia.org')));
    assert.equal(nearbyCardMediaUrls(concepts, 2, 640, opts).length, 2);
    assert.equal(nearbyCardMediaUrls(concepts, 3, 640, opts).length, 1);
  });

  it('skips blank media and dedupes identical urls', () => {
    const shared =
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/A.jpg/960px-A.jpg';
    const concepts = [item('a', shared), item('b', null), item('c', shared)];
    const urls = nearbyCardMediaUrls(concepts, 0, 500, opts);
    assert.equal(urls.length, 1);
    assert.ok(urls[0]?.includes('upload.wikimedia.org'));
  });
});
