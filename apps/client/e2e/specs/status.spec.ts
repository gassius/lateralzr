import { expect, test } from '@playwright/test';
import { capture, swipeBack, swipeForward } from '../helpers/capture';
import { visibleText } from '../helpers/locators';
import { disableMotionCss, openApp, preparePage } from '../helpers/preparePage';
import { expectStatusLineClearOfLaterality } from '../helpers/statusLayout';

test.describe('status screens', () => {
  test('initial loading silhouette (delayed first fetch)', async ({ page }, testInfo) => {
    await preparePage(page, { delayFirstMs: 120_000 });
    await page.goto('/?canonicalConcept=mushroom', { waitUntil: 'domcontentloaded' });
    await page.clock.fastForward(500);
    await page.getByTestId('loading-card').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Finding a starting point/i);
    await expect(page.getByTestId('laterality-control')).toBeVisible();
    await expectStatusLineClearOfLaterality(page);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading-initial', locale: 'en' });
  });

  test('initial loading silhouette ES (wrap at 320)', async ({ page }, testInfo) => {
    await preparePage(page, { delayFirstMs: 120_000 });
    await page.goto('/?canonicalConcept=mushroom&locale=es', { waitUntil: 'domcontentloaded' });
    await page.clock.fastForward(500);
    await page.getByTestId('loading-card').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Buscando un punto de partida/i);
    await expectStatusLineClearOfLaterality(page);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading-initial', locale: 'es' });
  });

  test('loading card (delayed load-more)', async ({ page }, testInfo) => {
    // Single-card deck; prefetch/load-more is held open so end-of-deck loading UI stays up.
    // skipNetworkIdle: the held request would otherwise block settle for the full delay.
    await openApp(page, 'canonicalConcept=loading-deck', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();

    // On the last card, a forward swipe sets pendingEndDeckLoad → LoadingCard silhouette.
    await swipeForward(page);
    await expect(page.getByTestId('loading-card')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Loading more ideas/i);
    await expectStatusLineClearOfLaterality(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading', locale: 'en' });
  });

  test('loading card ES (delayed load-more)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=loading-deck&locale=es', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizonte')).toBeVisible();
    await swipeForward(page);
    await expect(page.getByTestId('loading-card')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Cargando más ideas/i);
    await expectStatusLineClearOfLaterality(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading', locale: 'es' });
  });

  test('loading card at 200% e2e text scale', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=loading-deck&e2eTextScale=2', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await swipeForward(page);
    await expect(page.getByTestId('loading-card')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Loading more ideas/i);
    await expectStatusLineClearOfLaterality(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading-200', locale: 'en' });
  });

  test('back from end-of-deck loading returns to the last concept (Lz-36)', async ({ page }) => {
    await openApp(page, 'canonicalConcept=loading-deck', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await swipeForward(page);
    await expect(page.getByTestId('loading-card')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Loading more ideas/i);

    await swipeBack(page, 'Horizon');
    await expect(page.getByTestId('loading-card')).toHaveCount(0);
    await expect(page.getByTestId('deck-status-line')).toHaveCount(0);
    await expect(visibleText(page, 'Horizon')).toBeVisible();
  });
});
