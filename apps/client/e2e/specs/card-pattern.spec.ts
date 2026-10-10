import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-25 pattern variants — keyed by conceptKey hash % 3 (see patternPlacement.test.ts).
 * Critiquito compares 390-wide shots to the ticket preview PNGs.
 */
test.describe('card front pattern', () => {
  test('variant 01 descending current (long-label)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label');
    await expect(cardFrontTitle(page)).toBeVisible();
    await expect(page.getByTestId('card-front-pattern')).toBeAttached();
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-01-descending',
      locale: 'en',
    });
  });

  test('variant 02 ascending current (tide)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=tide');
    await expect(visibleText(page, 'Tide')).toBeVisible();
    await expect(page.getByTestId('card-front-pattern')).toBeAttached();
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-02-ascending',
      locale: 'en',
    });
  });

  test('variant 03 edge current (mushroom)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('card-front-pattern')).toBeAttached();
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-03-edge',
      locale: 'en',
    });
  });
});
