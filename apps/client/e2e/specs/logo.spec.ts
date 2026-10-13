import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { disableMotionCss, preparePage } from '../helpers/preparePage';
import { INTRO_FAST_FORWARD_MS } from '../helpers/viewports';

test.describe('logo assets', () => {
  test('full lockup on orange (intro hold)', async ({ page }, testInfo) => {
    // Hold the first API call so the orange intro lockup stays up for capture.
    await preparePage(page, { delayFirstMs: 120_000 });
    await page.goto('/?canonicalConcept=mushroom', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Lateralzr logo')).toBeVisible({ timeout: 8_000 });
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'logo', state: 'lockup-on-orange', locale: 'en' });
  });

  test('full lockup on orange (empty-deck error)', async ({ page }) => {
    // Static lockup still appears on the orange empty-deck error face after intro.
    await preparePage(page);
    await page.route('**/api/concepts/relationships', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'boom' }),
      });
    });
    await page.goto('/?canonicalConcept=mushroom', { waitUntil: 'domcontentloaded' });
    await page.clock.fastForward(INTRO_FAST_FORWARD_MS);
    await expect(page.getByLabel('Lateralzr logo')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/^Retry$/i)).toBeVisible({ timeout: 8_000 });
  });
});
