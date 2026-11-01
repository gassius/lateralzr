/**
 * Component contract tests for RasterizedSvgXml (review B1 / B3 / m2).
 * Display helpers + the same attach*() effect the component mounts in useEffect.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { clearPatternBitmapCacheForTests } from '@/lib/patternBitmapCache.ts';
import { attachRasterizedSvgXmlCapture } from '@/lib/rasterizedSvgXmlCapture.ts';
import { resolveRasterizedSvgXmlLayers } from '@/lib/rasterizedSvgXmlState.ts';

afterEach(() => {
  clearPatternBitmapCacheForTests();
});

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

describe('RasterizedSvgXml component (B3 web + m2 effect mount)', () => {
  it('web preferLiveSvg keeps SVG forever (E2E #connectors / pixel parity)', () => {
    const web = resolveRasterizedSvgXmlLayers({
      cacheKey: 'face@2:xMidYMid slice:xml',
      uri: 'data:image/png;base64,pattern',
      loadedCacheKey: 'face@2:xMidYMid slice:xml',
      captureFailed: false,
      preferLiveSvg: true,
    });
    assert.equal(web.showSvg, true);
    assert.equal(web.showImage, false);
  });

  it('mounts capture effect: cleanup on dep change cancels scheduled work', async () => {
    let ran = false;
    let scheduledRun: (() => void) | undefined;
    const attempted = { current: null as string | null };
    // First mount (settled).
    const first = attachRasterizedSvgXmlCapture({
      preferLiveSvg: false,
      captureEnabled: true,
      isCaptureStillEnabled: () => true,
      uri: null,
      captureFailed: false,
      hasAst: true,
      cacheKey: 'k1',
      captureAttemptedForKey: attempted,
      width: 8,
      height: 8,
      devicePixelRatio: 1,
      getSvgNode: () => ({
        toDataURL(cb) {
          ran = true;
          cb('x');
        },
      }),
      onMissingToDataURL: () => assert.fail('missing'),
      onCaptured: () => assert.fail('captured after cleanup'),
      onError: () => assert.fail('error'),
      schedule: (run) => {
        scheduledRun = run;
        return { cancel() {} };
      },
    });
    // Effect cleanup (captureEnabled→false / unmount) then re-attach gated off.
    first.cancel();
    const second = attachRasterizedSvgXmlCapture({
      preferLiveSvg: false,
      captureEnabled: false,
      isCaptureStillEnabled: () => false,
      uri: null,
      captureFailed: false,
      hasAst: true,
      cacheKey: 'k1',
      captureAttemptedForKey: attempted,
      width: 8,
      height: 8,
      devicePixelRatio: 1,
      getSvgNode: () => ({
        toDataURL(cb) {
          ran = true;
          cb('x');
        },
      }),
      onMissingToDataURL: () => {},
      onCaptured: () => {},
      onError: () => {},
      schedule: () => {
        assert.fail('must not schedule when captureEnabled is false');
        return { cancel() {} };
      },
    });
    second.cancel();
    scheduledRun?.();
    await Promise.resolve();
    assert.equal(ran, false);
  });
});
