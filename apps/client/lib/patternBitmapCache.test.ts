import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPatternBitmapCacheKey,
  clearPatternBitmapCacheForTests,
  getCachedPatternBitmap,
  patternBitmapCacheSizeForTests,
  patternXmlFingerprint,
  runPatternBitmapCapture,
  setCachedPatternBitmap,
} from './patternBitmapCache.ts';

describe('patternBitmapCache', () => {
  it('fingerprints xml by length + hash', () => {
    assert.notEqual(patternXmlFingerprint('<a/>'), patternXmlFingerprint('<b/>'));
    assert.equal(patternXmlFingerprint('<a/>'), patternXmlFingerprint('<a/>'));
  });

  it('builds stable keys from size + pixelRatio + xml', () => {
    const a = buildPatternBitmapCacheKey({
      width: 320.4,
      height: 500.6,
      pixelRatio: 2.75,
      xml: '<svg/>',
    });
    const b = buildPatternBitmapCacheKey({
      width: 320.4,
      height: 500.6,
      pixelRatio: 2.75,
      xml: '<svg/>',
    });
    const c = buildPatternBitmapCacheKey({
      width: 321,
      height: 500.6,
      pixelRatio: 2.75,
      xml: '<svg/>',
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it('LRU get/set and capture dedupe', async () => {
    clearPatternBitmapCacheForTests();
    const key = buildPatternBitmapCacheKey({
      width: 10,
      height: 10,
      pixelRatio: 1,
      xml: '<svg id="x"/>',
    });
    assert.equal(getCachedPatternBitmap(key), null);

    let runs = 0;
    const p1 = runPatternBitmapCapture(key, async () => {
      runs += 1;
      await Promise.resolve();
      return 'data:image/png;base64,aaa';
    });
    const p2 = runPatternBitmapCapture(key, async () => {
      runs += 1;
      return 'data:image/png;base64,bbb';
    });
    const [u1, u2] = await Promise.all([p1, p2]);
    assert.equal(u1, u2);
    assert.equal(runs, 1);
    assert.equal(getCachedPatternBitmap(key), 'data:image/png;base64,aaa');

    setCachedPatternBitmap(key, 'data:image/png;base64,zzz');
    assert.equal(getCachedPatternBitmap(key), 'data:image/png;base64,zzz');
    assert.equal(patternBitmapCacheSizeForTests(), 1);
  });
});
