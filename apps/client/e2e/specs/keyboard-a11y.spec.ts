import { expect, test } from '@playwright/test';
import { cardBackCopy, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-39 keyboard-only smoke (ES: ArrowRight / Enter / ArrowLeft).
 * Full loop without gestures — documents web key map in PR.
 */
test.describe('keyboard a11y', () => {
  test('ArrowRight / Enter / ArrowLeft complete a non-swipe loop', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');

    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    const surface = page.getByTestId('card-a11y-surface');
    await surface.focus();
    await expect(surface).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(visibleText(page, 'Mycelium')).toBeVisible({ timeout: 10_000 });

    await surface.focus();
    await page.keyboard.press('Enter');
    await expect(cardBackCopy(page)).toBeVisible({ timeout: 10_000 });

    await surface.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(visibleText(page, 'Mushroom')).toBeVisible({ timeout: 10_000 });
  });
});
