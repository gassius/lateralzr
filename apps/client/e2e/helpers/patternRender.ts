import { expect, type Page } from '@playwright/test';
import { cardFrontPattern } from './locators';

export type PatternRender = {
  ok: boolean;
  reason?: string;
  via?: 'image' | 'svg';
};

/**
 * PatternLayer uses the same raster path as native: PNG Image after capture.
 * Assert rendered output (img data URI, or live SVG while capture/fallback),
 * never the internal `#connectors` DOM node.
 */
export async function readPatternRender(page: Page): Promise<PatternRender> {
  return page.evaluate(() => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) {
      return { ok: false, reason: 'missing pattern' };
    }
    const img = pattern.querySelector('img');
    const src = img ? img.currentSrc || img.getAttribute('src') || '' : '';
    if (img && src.startsWith('data:image')) {
      return { ok: true, via: 'image' };
    }
    if (pattern.querySelector('svg')) {
      return { ok: true, via: 'svg' };
    }
    return { ok: false, reason: 'no image or svg in pattern' };
  });
}

/** Soft check: pattern has either Image or SVG painted. */
export async function expectPatternRendered(page: Page): Promise<void> {
  await expect(cardFrontPattern(page)).toBeAttached();
  await expect
    .poll(async () => readPatternRender(page), { timeout: 5_000 })
    .toMatchObject({ ok: true });
}

/**
 * Wait until the front pattern has finished rasterising to an Image.
 * Prefer this before flips — flipping while toDataURL is still on the main
 * thread flakes card-back under CI load. Falls back to SVG only if the
 * image never appears (onMissingToDataURL permanent fallback).
 */
export async function expectPatternRasterReady(page: Page): Promise<void> {
  await expect(cardFrontPattern(page)).toBeAttached();
  let sawSvg = false;
  try {
    await expect
      .poll(
        async () => {
          const r = await readPatternRender(page);
          if (r.via === 'svg') sawSvg = true;
          return r.via === 'image' ? 'image' : r.via === 'svg' ? 'svg' : 'missing';
        },
        { timeout: 10_000 },
      )
      .toBe('image');
  } catch (err) {
    if (!sawSvg) throw err;
    // Capture unavailable — permanent SvgAst is valid rendered output.
    await expect
      .poll(async () => readPatternRender(page), { timeout: 1_000 })
      .toMatchObject({ ok: true, via: 'svg' });
  }
  // Let underlay pre-captures finish so flip isn't fighting toDataURL.
  await page.waitForTimeout(200);
}
