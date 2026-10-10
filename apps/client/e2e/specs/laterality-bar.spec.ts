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

  test('tapping the 5th rail position selects Random entry and requests laterality 5', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=1&locale=en');
    await expect(page.getByTestId('laterality-label')).toContainText('Laterality · Same domain');

    const rail = page.getByTestId('laterality-rail');
    const box = await rail.boundingBox();
    expect(box, 'laterality-rail bounding box').toBeTruthy();
    if (!box) throw new Error('laterality-rail has no bounding box');

    const relationshipsWithFive = page.waitForRequest((req) => {
      if (!req.url().includes('/api/concepts/relationships') || req.method() !== 'POST') {
        return false;
      }
      try {
        const body = req.postDataJSON() as { laterality?: number };
        return body?.laterality === 5;
      } catch {
        return false;
      }
    });

    // 5th of 5 equal segments — click near the right edge of the rail.
    await rail.click({
      position: { x: Math.floor(box.width * 0.92), y: Math.floor(box.height / 2) },
    });

    await expect(page.getByTestId('laterality-label')).toContainText(
      'Laterality · Random entry',
    );
    await relationshipsWithFive;
  });
});
