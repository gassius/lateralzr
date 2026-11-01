/**
 * m2: Actually mount RasterizedSvgXml (RNTL) and cover useEffect deps +
 * cleanup (captureEnabledRef wiring / session.cancel on unmount & gate flip).
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import React from 'react';
// `pure` avoids jest `expect.extend` (we run under node:test).
import { act, cleanup, render } from '@testing-library/react-native/pure';
import { clearPatternBitmapCacheForTests } from '@/lib/patternBitmapCache.ts';
import { RasterizedSvgXml } from './RasterizedSvgXml.tsx';

type SvgMocks = {
  toDataURLImpl: ((cb: (b: string) => void, opts?: object) => void) | null;
  callCount: number;
};

function svgMocks(): SvgMocks {
  return (globalThis as unknown as { __rasterizedSvgXmlTestMocks: SvgMocks })
    .__rasterizedSvgXmlTestMocks;
}

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TINY_XML =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#f00"/></svg>';

async function flushScheduled(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function countHost(
  tree: { UNSAFE_root: { findAllByType: (t: React.ElementType) => unknown[] } },
  type: string,
): number {
  return tree.UNSAFE_root.findAllByType(type as unknown as React.ElementType).length;
}

afterEach(() => {
  cleanup();
  clearPatternBitmapCacheForTests();
  const mocks = svgMocks();
  mocks.toDataURLImpl = null;
  mocks.callCount = 0;
});

describe('RasterizedSvgXml mount (m2 RNTL)', () => {
  it('mounts, captures via toDataURL when captureEnabled, then shows Image', async () => {
    const mocks = svgMocks();
    const tree = render(
      <RasterizedSvgXml
        xml={TINY_XML}
        width={20}
        height={30}
        captureEnabled={true}
      />,
    );
    await flushScheduled();
    assert.ok(mocks.callCount >= 1, 'toDataURL should run when settled');
    // Image mock fires onLoad → SvgAst unmounts
    await flushScheduled();
    assert.equal(countHost(tree, 'SvgAst'), 0);
    assert.ok(countHost(tree, 'Image') >= 1);
  });

  it('captureEnabledRef: flipping gate off cancels before scheduled toDataURL', async () => {
    let toDataURLCalls = 0;
    svgMocks().toDataURLImpl = (cb) => {
      toDataURLCalls += 1;
      cb(TINY_PNG_B64);
    };

    const tree = render(
      <RasterizedSvgXml
        xml={TINY_XML}
        width={20}
        height={30}
        captureEnabled={true}
      />,
    );
    // Flip settle gate before the scheduled callback runs (effect cleanup + ref).
    tree.rerender(
      <RasterizedSvgXml
        xml={TINY_XML}
        width={20}
        height={30}
        captureEnabled={false}
      />,
    );
    await flushScheduled();
    assert.equal(
      toDataURLCalls,
      0,
      'cleanup + captureEnabledRef must prevent toDataURL after gate flips',
    );
  });

  it('unmount cleanup cancels in-flight scheduled capture', async () => {
    let toDataURLCalls = 0;
    svgMocks().toDataURLImpl = (cb) => {
      toDataURLCalls += 1;
      cb(TINY_PNG_B64);
    };

    const tree = render(
      <RasterizedSvgXml
        xml={TINY_XML}
        width={20}
        height={30}
        captureEnabled={true}
      />,
    );
    tree.unmount();
    await flushScheduled();
    assert.equal(toDataURLCalls, 0, 'unmount must cancel scheduled capture');
  });

  it('cacheKey change resets attempt and schedules a new capture', async () => {
    const mocks = svgMocks();
    const tree = render(
      <RasterizedSvgXml
        xml={TINY_XML}
        width={20}
        height={30}
        captureEnabled={true}
      />,
    );
    await flushScheduled();
    // Allow Image onLoad / sessionCapture setState to settle under act.
    await flushScheduled();
    const afterFirst = mocks.callCount;
    assert.ok(afterFirst >= 1);

    await act(async () => {
      tree.rerender(
        <RasterizedSvgXml
          xml={TINY_XML}
          width={40}
          height={30}
          captureEnabled={true}
        />,
      );
    });
    await flushScheduled();
    await flushScheduled();
    assert.ok(
      mocks.callCount > afterFirst,
      'width change → new cacheKey → new toDataURL',
    );
  });
});
