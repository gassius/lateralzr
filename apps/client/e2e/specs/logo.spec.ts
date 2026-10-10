import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { disableMotionCss, preparePage } from '../helpers/preparePage';

test.describe('logo assets', () => {
  test('full lockup on orange (empty-deck error)', async ({ page }, testInfo) => {
    // Lz-35 dropped the animated intro logo; static lockup still appears on the orange error face.
    await preparePage(page);
    await page.route('**/api/concepts/relationships', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'boom' }),
      });
    });
    await page.goto('/?canonicalConcept=mushroom', { waitUntil: 'domcontentloaded' });
    await page.clock.fastForward(500);
    await expect(page.getByLabel('Lateralzr logo')).toBeVisible({ timeout: 8_000 });
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'logo', state: 'lockup-on-orange', locale: 'en' });
  });
});
