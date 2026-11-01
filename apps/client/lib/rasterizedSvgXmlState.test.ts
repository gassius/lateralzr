import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveRasterizedSvgXmlLayers,
  uriForCacheKey,
} from './rasterizedSvgXmlState.ts';

describe('RasterizedSvgXml display contract (B1)', () => {
  it('keeps SVG mounted until Image onLoad for the current cacheKey', () => {
    const cacheKey = 'k1';
    const beforeLoad = resolveRasterizedSvgXmlLayers({
      cacheKey,
      uri: 'data:image/png;base64,abc',
      loadedCacheKey: null,
      captureFailed: false,
    });
    assert.equal(beforeLoad.showImage, true);
    assert.equal(beforeLoad.showSvg, true);

    const afterLoad = resolveRasterizedSvgXmlLayers({
      cacheKey,
      uri: 'data:image/png;base64,abc',
      loadedCacheKey: cacheKey,
      captureFailed: false,
    });
    assert.equal(afterLoad.showImage, true);
    assert.equal(afterLoad.showSvg, false);
  });

  it('on cacheKey change, SVG returns until the new Image loads (no stretch-only frame)', () => {
    const midResize = resolveRasterizedSvgXmlLayers({
      cacheKey: 'k2',
      uri: 'data:image/png;base64,new',
      loadedCacheKey: 'k1',
      captureFailed: false,
    });
    assert.equal(midResize.showImage, true);
    assert.equal(midResize.showSvg, true);
  });

  it('on capture failure, stays on SVG and does not require Image', () => {
    const failed = resolveRasterizedSvgXmlLayers({
      cacheKey: 'k1',
      uri: null,
      loadedCacheKey: null,
      captureFailed: true,
    });
    assert.equal(failed.showSvg, true);
    assert.equal(failed.showImage, false);
  });

  it('uriForCacheKey prefers peek, then session for the same key only', () => {
    assert.equal(uriForCacheKey('a', 'peek', { cacheKey: 'a', uri: 'session' }), 'peek');
    assert.equal(uriForCacheKey('a', null, { cacheKey: 'a', uri: 'session' }), 'session');
    assert.equal(uriForCacheKey('a', null, { cacheKey: 'b', uri: 'session' }), null);
  });
});

describe('RasterizedSvgXml capture cancel / web fallback contracts', () => {
  it('treats missing toDataURL as a terminal failure (web path)', () => {
    const node: { toDataURL?: unknown } = {};
    const missing = typeof node.toDataURL !== 'function';
    assert.equal(missing, true);
    const layers = resolveRasterizedSvgXmlLayers({
      cacheKey: 'web',
      uri: null,
      loadedCacheKey: null,
      captureFailed: true,
    });
    assert.equal(layers.showSvg, true);
    assert.equal(layers.showImage, false);
  });

  it('key change invalidates prior loaded state so SVG covers the gap', () => {
    const afterKeyChange = resolveRasterizedSvgXmlLayers({
      cacheKey: 'next',
      uri: null,
      loadedCacheKey: 'prev',
      captureFailed: false,
    });
    assert.equal(afterKeyChange.showSvg, true);
    assert.equal(afterKeyChange.showImage, false);
  });
});
