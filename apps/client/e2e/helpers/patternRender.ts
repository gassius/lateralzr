import { expect, type Page } from '@playwright/test';
import { PATTERN_BAKE_PIXEL } from '../../theme/pattern.ts';
import { cardFrontPattern } from './locators';
import {
  analyzePatternRasterPng,
  decodeDataImagePng,
} from './patternRasterAssert.ts';

export type PatternRender = {
  ok: boolean;
  reason?: string;
  via?: 'image' | 'svg' | 'missing';
  dataUri?: string;
  layoutWidth?: number;
  layoutHeight?: number;
  devicePixelRatio?: number;
  naturalWidth?: number;
  naturalHeight?: number;
};

/**
 * Build-time WebP/PNG pattern (no react-native-svg / toDataURL). Read the front
 * pattern DOM img — decode via canvas for pixel asserts.
 */
export async function readPatternRender(page: Page): Promise<PatternRender> {
  return page.evaluate(async () => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) {
      return { ok: false, reason: 'missing pattern' };
    }
    const img = pattern.querySelector('img');
    if (!img) {
      if (pattern.querySelector('svg')) {
        return { ok: false, reason: 'svg-only (deck must not mount rnsvg)', via: 'svg' };
      }
      return { ok: false, reason: 'no image in pattern' };
    }
    if (!img.complete || img.naturalWidth < 8) {
      return { ok: false, reason: 'image not loaded' };
    }
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, reason: 'no canvas' };
    }
    ctx.drawImage(img, 0, 0);
    let dataUri = '';
    try {
      dataUri = canvas.toDataURL('image/png');
    } catch {
      return { ok: false, reason: 'canvas tainted' };
    }
    const box = pattern.getBoundingClientRect();
    return {
      ok: true,
      via: 'image',
      dataUri,
      layoutWidth: box.width,
      layoutHeight: box.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  });
}

async function isFrontPatternImageReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) return false;
    if (pattern.querySelector('svg')) return false;
    const img = pattern.querySelector('img');
    return Boolean(img && img.complete && img.naturalWidth >= 8);
  });
}

/**
 * Wait until the front pattern shows a loaded build-time bake (no SVG subtree).
 * Asserts natural size matches PATTERN_BAKE_PIXEL (1074×1680 @3×), non-blank,
 * and optionally glow (#FFC98A) pixels from the baked asset.
 */
export async function expectPatternRasterReady(
  page: Page,
  options: { requireGlow?: boolean } = {},
): Promise<void> {
  await expect(cardFrontPattern(page)).toBeAttached();

  // Deck must never mount react-native-svg under the front pattern.
  await expect
    .poll(
      async () => {
        const hasSvg = await page.evaluate(() => {
          const pattern = document.querySelector('[data-testid="card-front-pattern"]');
          return Boolean(pattern?.querySelector('svg'));
        });
        return hasSvg ? 'svg' : 'no-svg';
      },
      { timeout: 12_000 },
    )
    .toBe('no-svg');

  await expect
    .poll(
      async () => {
        if (await isFrontPatternImageReady(page)) return 'image-ready';
        const r = await readPatternRender(page);
        if (r.via === 'svg') return 'svg';
        return r.reason ?? 'missing';
      },
      { timeout: 12_000 },
    )
    .toBe('image-ready');

  const render = await readPatternRender(page);
  expect(render.via, JSON.stringify(render)).toBe('image');
  expect(render.dataUri, 'png data uri from canvas').toBeTruthy();

  const expected = {
    width: PATTERN_BAKE_PIXEL.width,
    height: PATTERN_BAKE_PIXEL.height,
  };
  const png = decodeDataImagePng(render.dataUri!);
  const analysis = analyzePatternRasterPng(png, {
    expectedWidth: expected.width,
    expectedHeight: expected.height,
  });

  expect(
    analysis.sizeOk,
    `png ${analysis.width}x${analysis.height} vs bake ${expected.width}x${expected.height} (natural ${render.naturalWidth}x${render.naturalHeight})`,
  ).toBe(true);
  expect(
    analysis.nonBlank,
    `opaquePixels=${analysis.opaquePixels} (blank / trivial PNG)`,
  ).toBe(true);

  if (options.requireGlow) {
    expect(
      analysis.hasGlow,
      `glowPixels=${analysis.glowPixels} (need #FFC98A-ish connector signal)`,
    ).toBe(true);
  }
}
