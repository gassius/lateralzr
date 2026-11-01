/**
 * Component contract tests for RasterizedSvgXml (review B1).
 * Pure display-state machine — same helpers the component uses at render time.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRasterizedSvgXmlLayers } from '@/lib/rasterizedSvgXmlState.ts';

describe('RasterizedSvgXml component (B1 blank-flash)', () => {
  it('fallback SvgAst stays mounted until Image onLoad fires for cacheKey', () => {
    const cacheKey = 'face@2:xMidYMid slice:xml';
    const uri = 'data:image/png;base64,pattern';

    const decoding = resolveRasterizedSvgXmlLayers({
      cacheKey,
      uri,
      loadedCacheKey: null,
      captureFailed: false,
    });
    assert.equal(decoding.showSvg, true, 'SVG must remain while Image decodes');
    assert.equal(decoding.showImage, true, 'Image mounts on top as soon as URI exists');

    const ready = resolveRasterizedSvgXmlLayers({
      cacheKey,
      uri,
      loadedCacheKey: cacheKey,
      captureFailed: false,
    });
    assert.equal(ready.showSvg, false, 'SVG unmounts only after onLoad for this key');
    assert.equal(ready.showImage, true);
  });
});
