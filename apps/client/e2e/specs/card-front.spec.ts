import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('card front', () => {
  test('short label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-front', state: 'short-label', locale: 'en' });
  });

  test('long multi-line label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    // aria-label keeps the unwrapped phrase; display text may include \\n / shrink wraps.
    await expect(title).toHaveAttribute(
      'aria-label',
      /extraordinarily elaborate multidisciplinary conceptual framework/i,
    );
    await capture(page, testInfo, { screen: 'card-front', state: 'long-label', locale: 'en' });
  });
});
