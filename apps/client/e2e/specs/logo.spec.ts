import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { disableMotionCss, preparePage } from '../helpers/preparePage';

test.describe('logo assets', () => {
  test('full lockup on orange (intro hold)', async ({ page }, testInfo) => {
    // Hold the first API call so the orange intro lockup stays up for capture.
    await preparePage(page, { delayFirstMs: 120_000 });
    await page.goto('/?canonicalConcept=mushroom', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Lateralzr logo')).toBeVisible({ timeout: 8_000 });
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'logo', state: 'lockup-on-orange', locale: 'en' });
  });
});
