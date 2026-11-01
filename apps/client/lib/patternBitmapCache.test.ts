import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPatternBitmapCacheKey,
  clearPatternBitmapCacheForTests,
  estimatePatternBitmapBytes,
  getCachedPatternBitmap,
  patternBitmapCacheBytesForTests,
  patternBitmapCacheSizeForTests,
  patternXmlFingerprint,
  peekCachedPatternBitmap,
  resolveCapturePixelSize,
  runPatternBitmapCapture,
  setCachedPatternBitmap,
  PATTERN_BITMAP_MAX_EDGE,
  PATTERN_BITMAP_MAX_PIXEL_RATIO,
} from './patternBitmapCache.ts';

describe('patternBitmapCache', () => {
  it('fingerprints xml by length + hash', () => {
    assert.notEqual(patternXmlFingerprint('<a/>'), patternXmlFingerprint('<b/>'));
    assert.equal(patternXmlFingerprint('<a/>'), patternXmlFingerprint('<a/>'));
  });

  it('includes preserveAspectRatio in the cache key', () => {
    const base = {
      width: 320,
      height: 500,
      pixelRatio: 2,
      xml: '<svg/>',
    };
    const a = buildPatternBitmapCacheKey({
      ...base,
      preserveAspectRatio: 'xMidYMid slice',
    });
    const b = buildPatternBitmapCacheKey({
      ...base,
      preserveAspectRatio: 'xMidYMid meet',
    });
    assert.notEqual(a, b);
  });

  it('caps pixel ratio and long edge for capture size', () => {
    const capped = resolveCapturePixelSize({
      width: 2000,
      height: 2000,
      pixelRatio: 4,
    });
    assert.equal(capped.pixelRatio, PATTERN_BITMAP_MAX_PIXEL_RATIO);
    assert.ok(Math.max(capped.width, capped.height) <= PATTERN_BITMAP_MAX_EDGE);
  });

  it('peek does not require a prior get; set tracks byte budget', () => {
    clearPatternBitmapCacheForTests();
    const key = buildPatternBitmapCacheKey({
      width: 10,
      height: 10,
      pixelRatio: 1,
      xml: '<svg id="x"/>',
      preserveAspectRatio: 'xMidYMid slice',
    });
    assert.equal(peekCachedPatternBitmap(key), null);
    const bytes = estimatePatternBitmapBytes(10, 10);
    setCachedPatternBitmap(key, 'data:image/png;base64,aaa', bytes);
    assert.equal(peekCachedPatternBitmap(key), 'data:image/png;base64,aaa');
    assert.equal(getCachedPatternBitmap(key), 'data:image/png;base64,aaa');
    assert.equal(patternBitmapCacheSizeForTests(), 1);
    assert.equal(patternBitmapCacheBytesForTests(), bytes);
  });

  it('dedupes in-flight captures', async () => {
    clearPatternBitmapCacheForTests();
    const key = buildPatternBitmapCacheKey({
      width: 10,
      height: 10,
      pixelRatio: 1,
      xml: '<svg id="y"/>',
      preserveAspectRatio: 'xMidYMid slice',
    });
    let runs = 0;
    const p1 = runPatternBitmapCapture(key, async () => {
      runs += 1;
      await Promise.resolve();
      return 'data:image/png;base64,aaa';
    }, 16);
    const p2 = runPatternBitmapCapture(key, async () => {
      runs += 1;
      return 'data:image/png;base64,bbb';
    }, 16);
    const [u1, u2] = await Promise.all([p1, p2]);
    assert.equal(u1, u2);
    assert.equal(runs, 1);
  });
});
