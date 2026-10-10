import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

test.describe('laterality bar', () => {
  for (const grade of [1, 3, 5] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`grade ${grade} (${locale})`, async ({ page }, testInfo) => {
        await openApp(page, `canonicalConcept=mushroom&laterality=${grade}&locale=${locale}`);
        await expect(page.getByTestId('laterality-control')).toBeVisible();
        await expect(page.getByTestId('laterality-rail')).toBeVisible();
        await expect(page.getByTestId('laterality-label')).toBeVisible();
        await expect(page.getByTestId('laterality-wordmark')).toHaveCount(0);
        await capture(page, testInfo, {
          screen: 'laterality-bar',
          state: `grade-${grade}`,
          locale,
        });
      });
    }
  }
});
