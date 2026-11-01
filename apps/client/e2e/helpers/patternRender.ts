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

export async function expectPatternRendered(page: Page): Promise<void> {
  await expect(cardFrontPattern(page)).toBeAttached();
  await expect
    .poll(async () => readPatternRender(page), { timeout: 5_000 })
    .toMatchObject({ ok: true });
}
