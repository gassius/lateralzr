/**
 * Mounts the RasterizedSvgXml capture effect (attachRasterizedSvgXmlCapture)
 * and covers deps + cleanup — same wiring the component useEffect uses.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { clearPatternBitmapCacheForTests } from './patternBitmapCache.ts';
import { attachRasterizedSvgXmlCapture } from './rasterizedSvgXmlCapture.ts';

afterEach(() => {
  clearPatternBitmapCacheForTests();
});

function baseOptions(
  overrides: Partial<Parameters<typeof attachRasterizedSvgXmlCapture>[0]> & {
    captureAttemptedForKey: { current: string | null };
  },
) {
  return {
    preferLiveSvg: false,
    captureEnabled: true,
    isCaptureStillEnabled: () => true,
    uri: null,
    captureFailed: false,
    hasAst: true,
    cacheKey: 'k1',
    width: 10,
    height: 20,
    devicePixelRatio: 1,
    getSvgNode: () => ({
      toDataURL(cb: (b: string) => void) {
        cb('abc');
      },
    }),
    onMissingToDataURL: () => {
      assert.fail('unexpected missing toDataURL');
    },
    onCaptured: () => {},
    onError: () => {
      assert.fail('unexpected error');
    },
    ...overrides,
  };
}

describe('attachRasterizedSvgXmlCapture (RasterizedSvgXml effect mount)', () => {
  it('preferLiveSvg (web) never schedules capture', () => {
    let scheduled = false;
    const attempted = { current: null as string | null };
    const session = attachRasterizedSvgXmlCapture(
      baseOptions({
        preferLiveSvg: true,
        captureAttemptedForKey: attempted,
        schedule: (run) => {
          scheduled = true;
          run();
          return { cancel() {} };
        },
      }),
    );
    session.cancel();
    assert.equal(scheduled, false);
    assert.equal(attempted.current, null);
  });

  it('cleanup cancel before scheduled run prevents toDataURL (unmount / dep change)', async () => {
    let ran = false;
    let scheduledRun: (() => void) | undefined;
    const attempted = { current: null as string | null };
    const session = attachRasterizedSvgXmlCapture(
      baseOptions({
        captureAttemptedForKey: attempted,
        getSvgNode: () => ({
          toDataURL(cb) {
            ran = true;
            cb('abc');
          },
        }),
        onCaptured: () => {
          assert.fail('should not capture after cleanup');
        },
        schedule: (run) => {
          scheduledRun = run;
          return { cancel() {} };
        },
      }),
    );
    assert.equal(attempted.current, 'k1');
    session.cancel();
    scheduledRun?.();
    await Promise.resolve();
    assert.equal(ran, false);
  });

  it('cacheKey dep change: prior cleanup + new attach schedules once per key', () => {
    const attempted = { current: null as string | null };
    let schedules = 0;
    const first = attachRasterizedSvgXmlCapture(
      baseOptions({
        cacheKey: 'k1',
        captureAttemptedForKey: attempted,
        schedule: () => {
          schedules += 1;
          return { cancel() {} };
        },
      }),
    );
    first.cancel();
    // Simulate cacheKey effect reset (RasterizedSvgXml resets attempted on key change).
    attempted.current = null;
    const second = attachRasterizedSvgXmlCapture(
      baseOptions({
        cacheKey: 'k2',
        captureAttemptedForKey: attempted,
        schedule: () => {
          schedules += 1;
          return { cancel() {} };
        },
      }),
    );
    second.cancel();
    assert.equal(schedules, 2);
    assert.equal(attempted.current, 'k2');
  });

  it('same cacheKey is not re-attempted while attempted ref still holds it', () => {
    const attempted = { current: 'k1' as string | null };
    let schedules = 0;
    attachRasterizedSvgXmlCapture(
      baseOptions({
        cacheKey: 'k1',
        captureAttemptedForKey: attempted,
        schedule: () => {
          schedules += 1;
          return { cancel() {} };
        },
      }),
    );
    assert.equal(schedules, 0);
  });

  it('m1: settle gate false inside scheduled run skips toDataURL', async () => {
    let ran = false;
    let settled = true;
    let scheduledRun: (() => void) | undefined;
    const attempted = { current: null as string | null };
    attachRasterizedSvgXmlCapture(
      baseOptions({
        captureAttemptedForKey: attempted,
        isCaptureStillEnabled: () => settled,
        getSvgNode: () => ({
          toDataURL(cb) {
            ran = true;
            cb('abc');
          },
        }),
        onCaptured: () => {
          assert.fail('must not capture after settle flips');
        },
        schedule: (run) => {
          scheduledRun = run;
          return { cancel() {} };
        },
      }),
    );
    settled = false;
    scheduledRun?.();
    await Promise.resolve();
    assert.equal(ran, false);
  });

  it('captureEnabled false (swipe gate) does not schedule', () => {
    let scheduled = false;
    attachRasterizedSvgXmlCapture(
      baseOptions({
        captureEnabled: false,
        captureAttemptedForKey: { current: null },
        schedule: () => {
          scheduled = true;
          return { cancel() {} };
        },
      }),
    );
    assert.equal(scheduled, false);
  });
});
