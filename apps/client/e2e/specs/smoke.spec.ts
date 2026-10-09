import { expect, test } from '@playwright/test';
import { flipCard, swipeForward } from '../helpers/capture';
import { cardBackCopy, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== '390x844', 'smoke runs on 390x844 only');
  });

  test('card renders, flips, advances, no console errors', async ({ page }) => {
    const consoleBucket = await openApp(page, 'canonicalConcept=mushroom');

    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('laterality-wordmark')).toBeVisible();

    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();

    // Flip back then swipe forward to the next concept.
    await flipCard(page);
    await swipeForward(page);
    await expect(visibleText(page, 'Mycelium')).toBeVisible({ timeout: 8_000 });

    const ignored = [/Download the React DevTools/i, /favicon/i];
    const realErrors = [...consoleBucket.errors, ...consoleBucket.pageErrors].filter(
      (line) => !ignored.some((re) => re.test(line)),
    );
    expect(realErrors, `console errors:\n${realErrors.join('\n')}`).toEqual([]);
  });
});
