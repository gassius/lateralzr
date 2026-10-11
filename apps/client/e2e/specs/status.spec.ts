import { expect, test } from '@playwright/test';
import { capture, swipeBack, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
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

  test('offline status line with Retry (Lz-37)', async ({ page, context }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await swipeForward(page, 'Mycelium');
    await expect(visibleText(page, 'Mycelium')).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByTestId('deck-status-line')).toContainText(/Offline/i, {
      timeout: 2_000,
    });
    const retry = page.getByTestId('deck-status-retry');
    await expect(retry).toBeVisible();
    await expect(retry).toHaveAttribute('aria-label', /Retry/i);
    // Current card stays; history back still works within loaded deck.
    await expect(visibleText(page, 'Mycelium')).toBeVisible();
    await expect(page.getByTestId('loading-card')).toHaveCount(0);
    await expectStatusLineClearOfLaterality(page);

    const stack = page.getByTestId('card-laterality-group');
    const box = await stack.boundingBox();
    if (!box) throw new Error('card-laterality-group has no bounding box');
    const y = box.y + box.height * 0.3;
    await page.mouse.move(box.x + box.width * 0.2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, y, { steps: 16 });
    await page.mouse.up();
    await expect(visibleText(page, 'Mushroom')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Offline/i);

    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'offline', locale: 'en' });

    // PRR B1 — still-offline: Retry keeps the line; card stays (force refetch fail).
    let failNextRelationships = true;
    await page.route('**/api/concepts/relationships', async (route) => {
      if (failNextRelationships) {
        failNextRelationships = false;
        await route.abort('failed');
        return;
      }
      await route.fallback();
    });
    await retry.click();
    await expect(page.getByTestId('deck-status-line')).toContainText(/Offline/i, {
      timeout: 2_000,
    });
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    // PRR B1 — restore CDP network first, then click Retry. Re-assert Offline UI
    // (block online; fake navigator.onLine + offline event) so clear depends on
    // reportRetrySucceeded, not setOnline. Fulfill unique concepts so load-more
    // appends (mushroom fixture alone would coldStart/retryEmpty without clearing).
    await page.evaluate(() => {
      window.addEventListener('online', (e) => e.stopImmediatePropagation(), true);
    });
    await context.setOffline(false);
    await expect(async () => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => false,
        });
        window.dispatchEvent(new Event('offline'));
      });
      await expect(page.getByTestId('deck-status-line')).toContainText(/Offline/i, {
        timeout: 800,
      });
    }).toPass({ timeout: 3_000 });
    await expect(retry).toBeVisible();

    await page.route('**/api/concepts/relationships', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            start: { id: 901, label: 'retry-seed' },
            nodes: [
              {
                id: 901,
                label: 'retry-seed',
                shortDescription: 'Unique seed for offline retry append.',
                complexity: 2,
                wikiUrl: null,
                mediaUrl: null,
                media: [],
                locale: 'en',
                degree: 0,
              },
              {
                id: 902,
                label: 'retry-neighbor',
                shortDescription: 'Unique neighbor for offline retry append.',
                complexity: 2,
                wikiUrl: null,
                mediaUrl: null,
                media: [],
                locale: 'en',
                degree: 1,
              },
            ],
            edges: [{ id: 910, from: 901, to: 902, strength: 0.8, laterality: 3 }],
            meta: {
              depth: 2,
              limit: 12,
              minStrength: 0,
              hasMore: false,
              locale: 'en',
              laterality: 3,
            },
          },
        }),
      });
    });

    const isRelationshipsPost = (req: { url: () => string; method: () => string }) =>
      req.url().includes('/api/concepts/relationships') && req.method() === 'POST';
    let postsFromClick = 0;
    const onRelationshipsPost = (req: { url: () => string; method: () => string }) => {
      if (isRelationshipsPost(req)) postsFromClick += 1;
    };
    page.on('request', onRelationshipsPost);
    try {
      postsFromClick = 0;
      await retry.click();
      // Arm wait after click so a pre-armed wait cannot match a stray POST (PRR B1).
      if (postsFromClick === 0) {
        await page.waitForRequest(isRelationshipsPost, { timeout: 2_000 });
      }
      // Clear depends on retrySucceeded (online → setOnline is suppressed above).
      await expect(page.getByTestId('deck-status-retry')).toHaveCount(0, { timeout: 2_000 });
      await expect(
        page.getByTestId('deck-status-line').filter({ hasText: /Offline/i }),
      ).toHaveCount(0);
    } finally {
      page.off('request', onRelationshipsPost);
    }
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
  });

  test('offline status line ES', async ({ page, context }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await expect(visibleText(page, 'Seta')).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId('deck-status-line')).toContainText(/Sin conexión/i, {
      timeout: 2_000,
    });
    await expect(page.getByTestId('deck-status-retry')).toHaveAttribute(
      'aria-label',
      /Reintentar/i,
    );
    await expect(visibleText(page, 'Seta')).toBeVisible();
    await expectStatusLineClearOfLaterality(page);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'offline', locale: 'es' });
  });

  test('back from end-of-deck loading returns to the same last concept N>0 (Lz-36)', async ({
    page,
  }) => {
    // Two-card deck: old i-1 pop would show Horizon; correct path keeps Meridian (N).
    await openApp(page, 'canonicalConcept=loading-deck-two', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await swipeForward(page, 'Meridian');
    await swipeForward(page);
    await expect(page.getByTestId('loading-card')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('deck-status-line')).toContainText(/Loading more ideas/i);

    await swipeBack(page, 'Meridian');
    await expect(page.getByTestId('loading-card')).toHaveCount(0);
    await expect(page.getByTestId('deck-status-line')).toHaveCount(0);
    // Front title must be card N (Meridian), not N-1 (Horizon) from an unguarded pop.
    await expect(cardFrontTitle(page)).toHaveText('Meridian');
  });
});
