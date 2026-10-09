import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('card front', () => {
  test('short label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await capture(page, testInfo, 'card-front-short-label');
  });

  test('long multi-line label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label');
    await expect(
      visibleText(page, /extraordinarily elaborate multidisciplinary conceptual framework/i),
    ).toBeVisible();
    await capture(page, testInfo, 'card-front-long-label');
  });
});
