import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

/** `color.front` #F78D1E — §5.2 wordmark tile (never shell). */
const WORDMARK_TILE_RGB = /rgba?\(\s*247,\s*141,\s*30/;

test.describe('laterality bar', () => {
  for (const grade of [1, 3, 5] as const) {
    test(`grade ${grade}`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&laterality=${grade}`);
      const wordmark = page.getByTestId('laterality-wordmark');
      await expect(wordmark).toBeVisible();
      await expect(page.getByTestId('laterality-submenu')).toBeVisible();
      const bg = await wordmark.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, 'wordmark must sit on orange tile, not shell').toMatch(WORDMARK_TILE_RGB);
      await capture(page, testInfo, {
        screen: 'laterality-bar',
        state: `grade-${grade}`,
        locale: 'en',
      });
    });
  }
});
