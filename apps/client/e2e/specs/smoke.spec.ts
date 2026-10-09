import { expect, test } from '@playwright/test';
import { flipCard, swipeForward } from '../helpers/capture';
import { cardBackCopy, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('smoke', () => {
  test('card renders, flips, advances, no console errors', async ({ page }) => {
    const consoleBucket = await openApp(page, 'canonicalConcept=mushroom');

    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('laterality-wordmark')).toBeVisible();

    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();

    await flipCard(page);
    await swipeForward(page, 'Mycelium');
    await expect(visibleText(page, 'Mycelium')).toBeVisible();

    const ignored = [
      /Download the React DevTools/i,
      /favicon/i,
      // RNGH web can log this during teardown under Playwright's clock; not an app failure.
      /No handler for tag/i,
    ];
    const realErrors = [...consoleBucket.errors, ...consoleBucket.pageErrors].filter(
      (line) => !ignored.some((re) => re.test(line)),
    );
    expect(realErrors, `console errors:\n${realErrors.join('\n')}`).toEqual([]);
  });
});
