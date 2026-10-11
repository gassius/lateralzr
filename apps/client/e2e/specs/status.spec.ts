import { expect, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { visibleText } from '../helpers/locators';
import { disableMotionCss, openApp, preparePage } from '../helpers/preparePage';
import {
  expectStatusLineClearOfLaterality,
  waitForStableLoadingChrome,
} from '../helpers/statusLayout';
import { INTRO_FAST_FORWARD_MS } from '../helpers/viewports';

test.describe('status screens', () => {
  test('initial loading silhouette (delayed first fetch)', async ({ page }, testInfo) => {
    await preparePage(page, { delayFirstMs: 120_000 });
    await page.goto('/?canonicalConcept=mushroom', { waitUntil: 'domcontentloaded' });
    // Intro lockup first (same as main); silhouette only after MIN_INTRO_LOGO_MS.
    await expect(page.getByLabel('Lateralzr logo')).toBeVisible({ timeout: 8_000 });
    await page.clock.fastForward(INTRO_FAST_FORWARD_MS);
    await page.getByTestId('loading-card').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Finding a starting point/i);
    await expect(page.getByTestId('laterality-control')).toBeVisible();
    // 390/430: wait for settled card + full-width rail before capture (AD).
    await waitForStableLoadingChrome(page);
    await expectStatusLineClearOfLaterality(page);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading-initial', locale: 'en' });
  });

  test('initial loading silhouette ES (wrap at 320)', async ({ page }, testInfo) => {
    await preparePage(page, { delayFirstMs: 120_000 });
    await page.goto('/?canonicalConcept=mushroom&locale=es', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Lateralzr logo')).toBeVisible({ timeout: 8_000 });
    await page.clock.fastForward(INTRO_FAST_FORWARD_MS);
    await page.getByTestId('loading-card').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Buscando un punto de partida/i);
    await waitForStableLoadingChrome(page);
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
    await expect(page.getByTestId('laterality-label')).toBeVisible();
    await expect(page.getByTestId('laterality-rail')).toBeVisible();
    await expectStatusLineClearOfLaterality(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading-200', locale: 'en' });
  });

  test('loading card at 200% e2e text scale ES', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=loading-deck&locale=es&e2eTextScale=2', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizonte')).toBeVisible();
    await swipeForward(page);
    await expect(page.getByTestId('loading-card')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Cargando más ideas/i);
    await expect(page.getByTestId('laterality-label')).toBeVisible();
    await expect(page.getByTestId('laterality-rail')).toBeVisible();
    await expectStatusLineClearOfLaterality(page);
    await capture(page, testInfo, { screen: 'status', state: 'loading-200', locale: 'es' });
  });
});
