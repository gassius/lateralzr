import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

test.describe('laterality bar', () => {
  for (const grade of [1, 3, 5] as const) {
    test(`grade ${grade}`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&laterality=${grade}`);
      await expect(page.getByTestId('laterality-wordmark')).toBeVisible();
      await expect(page.getByTestId('laterality-submenu')).toBeVisible();
      await capture(page, testInfo, `laterality-bar-grade-${grade}`);
    });
  }
});
