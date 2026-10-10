import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-31: laterality bottom sheet open (guide §12.1).
 * Engineer Supervisor: enable “Laterality sheet open” for en and es.
 */
test.describe('laterality sheet', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`open (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&laterality=4&locale=${locale}`);
      await expect(page.getByTestId('laterality-label')).toBeVisible();
      await page.getByTestId('laterality-label').click();
      await expect(page.getByTestId('laterality-sheet')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-title')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-row-4')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-handle')).toBeVisible();

      await capture(page, testInfo, {
        screen: 'laterality-sheet',
        state: 'open',
        locale,
      });
    });
  }
});
