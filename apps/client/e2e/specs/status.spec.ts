import { expect, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('status screens', () => {
  test('loading card (delayed load-more)', async ({ page }, testInfo) => {
    // Single-card deck; prefetch/load-more is held open so end-of-deck loading UI stays up.
    // skipNetworkIdle: the held request would otherwise block settle for the full delay.
    await openApp(page, 'canonicalConcept=loading-deck', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();

    // On the last card, a forward swipe sets pendingEndDeckLoad → DeckStatusCard loading.
    await swipeForward(page);
    await expect(page.getByText(/Loading more ideas/i)).toBeVisible({ timeout: 8_000 });
    await capture(page, testInfo, { screen: 'status', state: 'loading', locale: 'en' });
  });
});
