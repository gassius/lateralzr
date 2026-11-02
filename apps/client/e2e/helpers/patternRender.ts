import { expect, type Page } from '@playwright/test';
import { cardFrontPattern } from './locators';
import {
  analyzePatternRasterPng,
  decodeDataImagePng,
  PATTERN_BITMAP_MAX_PIXEL_RATIO_CLIENT,
} from './patternRasterAssert.ts';

export type PatternRender = {
  ok: boolean;
  reason?: string;
  via?: 'image' | 'svg' | 'capture-failed';
  dataUri?: string;
  layoutWidth?: number;
  layoutHeight?: number;
  devicePixelRatio?: number;
};

/**
 * PatternLayer rasterises to a PNG Image (same path as native). Read the
 * front-pattern DOM — never query `#connectors` (gone after Image onLoad).
 */
export async function readPatternRender(page: Page): Promise<PatternRender> {
  return page.evaluate(() => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) {
      return { ok: false, reason: 'missing pattern' };
    }
    if (pattern.querySelector('[data-testid="pattern-raster-capture-failed"]')) {
      return { ok: false, reason: 'capture-failed', via: 'capture-failed' };
    }
    const img = pattern.querySelector('img');
    const src = img ? img.currentSrc || img.getAttribute('src') || '' : '';
    // Require PNG data URI — not a generic data:image (blank jpeg would pass).
    if (img && src.startsWith('data:image/png')) {
      const box = pattern.getBoundingClientRect();
      return {
        ok: true,
        via: 'image',
        dataUri: src,
        layoutWidth: box.width,
        layoutHeight: box.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      };
    }
    if (pattern.querySelector('svg')) {
      return { ok: false, reason: 'svg-only (raster pending or failed)', via: 'svg' };
    }
    return { ok: false, reason: 'no png image in pattern' };
  });
}

/** Front-card capture settled: PNG Image mounted and SvgAst unmounted under it. */
async function isFrontRasterSettled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) return false;
    if (pattern.querySelector('[data-testid="pattern-raster-capture-failed"]')) {
      return false;
    }
    const img = [...pattern.querySelectorAll('img')].find((el) => {
      const src = el.currentSrc || el.getAttribute('src') || '';
      return src.startsWith('data:image/png');
    });
    if (!img?.parentElement) return false;
    // Glow overlay SvgXml is a sibling of RasterizedSvgXml, not inside img's parent.
    // SvgAst (fallback) is a sibling of Image under the same raster root — must be gone.
    return img.parentElement.querySelector('svg') == null;
  });
}

function expectedCaptureSize(
  layoutWidth: number,
  layoutHeight: number,
  devicePixelRatio: number,
): { width: number; height: number } {
  const pixelRatio = Math.min(
    Math.max(devicePixelRatio, 1),
    PATTERN_BITMAP_MAX_PIXEL_RATIO_CLIENT,
  );
  return {
    width: Math.max(1, Math.round(layoutWidth * pixelRatio)),
    height: Math.max(1, Math.round(layoutHeight * pixelRatio)),
  };
}

/**
 * Wait until the front pattern has a finished PNG raster (Image mounted,
 * SvgAst unmounted). Fails on capture-failed marker or svg-only timeout.
 * Optionally asserts non-blank + glow (#FFC98A) pixels (pulse specs).
 */
export async function expectPatternRasterReady(
  page: Page,
  options: { requireGlow?: boolean } = {},
): Promise<void> {
  await expect(cardFrontPattern(page)).toBeAttached();

  // Explicit failure marker — never treat as a soft SVG pass.
  await expect(page.getByTestId('pattern-raster-capture-failed')).toHaveCount(0);

  // Poll requires settled DOM *and* a readable PNG URI in one tick — concurrent
  // card rasters can remount SvgAst between a bare settle check and the read.
  let settled: PatternRender | null = null;
  await expect
    .poll(
      async () => {
        if ((await page.getByTestId('pattern-raster-capture-failed').count()) > 0) {
          settled = null;
          return 'capture-failed';
        }
        if (!(await isFrontRasterSettled(page))) {
          settled = null;
          const r = await readPatternRender(page);
          if (r.via === 'image') return 'image-decoding';
          return r.via === 'svg' ? 'svg' : (r.reason ?? 'missing');
        }
        const render = await readPatternRender(page);
        if (render.via !== 'image' || !render.dataUri) {
          settled = null;
          return render.via === 'svg' ? 'svg' : (render.reason ?? 'missing');
        }
        const expected = expectedCaptureSize(
          render.layoutWidth ?? 0,
          render.layoutHeight ?? 0,
          render.devicePixelRatio ?? 1,
        );
        const png = decodeDataImagePng(render.dataUri);
        const analysis = analyzePatternRasterPng(png, {
          expectedWidth: expected.width,
          expectedHeight: expected.height,
        });
        if (!analysis.sizeOk) {
          settled = null;
          return `size-${analysis.width}x${analysis.height}`;
        }
        if (!analysis.nonBlank) {
          settled = null;
          return 'blank';
        }
        if (options.requireGlow && !analysis.hasGlow) {
          settled = null;
          return `no-glow-${analysis.glowPixels}`;
        }
        settled = render;
        return 'image-ready';
      },
      { timeout: 12_000 },
    )
    .toBe('image-ready');

  expect(settled?.via, JSON.stringify(settled)).toBe('image');
  expect(settled?.dataUri, 'png data uri').toBeTruthy();
}
