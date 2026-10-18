import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { capture, swipeBack, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import {
  disableMotionCss,
  openApp,
  preparePage,
  settleAfterNavigation,
} from '../helpers/preparePage';
import { INTRO_FAST_FORWARD_MS } from '../helpers/viewports';

const REL_FIXTURES = path.join(__dirname, '..', 'fixtures', 'relationships');

function readRelFixture(name: string): string {
  return fs.readFileSync(path.join(REL_FIXTURES, name), 'utf8');
}

const EMPTY_BATCH_EN = JSON.stringify({
  status: 'success',
  data: {
    start: { id: 0, label: '' },
    nodes: [],
    edges: [],
    meta: {
      depth: 2,
      limit: 12,
      minStrength: 0,
      hasMore: false,
      locale: 'en',
    },
  },
});

const EMPTY_BATCH_ES = JSON.stringify({
  status: 'success',
  data: {
    start: { id: 0, label: '' },
    nodes: [],
    edges: [],
    meta: {
      depth: 2,
      limit: 12,
      minStrength: 0,
      hasMore: false,
      locale: 'es',
    },
  },
});

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

    await swipeBack(page, 'Mushroom');
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

  for (const locale of ['en', 'es'] as const) {
    const neighbourhoodCopy =
      locale === 'es' ? /Cargando un vecindario nuevo/i : /Loading a new neighborhood/i;

    test(`neighbourhood loading status stays in the control row (Lz-38) (${locale})`, async ({
      page,
    }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&laterality=1&locale=${locale}`, {
        skipNetworkIdle: true,
      });
      await expect(visibleText(page, locale === 'es' ? 'Seta' : 'Mushroom')).toBeVisible();

      // Hold the laterality-swap fetch open so the status line stays readable.
      await page.route('**/api/concepts/relationships', async (route) => {
        const body = (() => {
          try {
            return route.request().postDataJSON() as { laterality?: number };
          } catch {
            return {};
          }
        })();
        if (body?.laterality === 5) {
          // Hold open like delayLoadMoreMs — status line must stay while the card remains.
          await new Promise((r) => setTimeout(r, 120_000));
          await route.fallback();
          return;
        }
        await route.fallback();
      });

      const rail = page.getByTestId('laterality-rail');
      const box = await rail.boundingBox();
      if (!box) throw new Error('laterality-rail has no bounding box');
      await rail.click({
        position: { x: Math.floor(box.width * 0.92), y: Math.floor(box.height / 2) },
      });

      await page.clock.fastForward(300);
      await expect(page.getByTestId('deck-status-line')).toContainText(neighbourhoodCopy, {
        timeout: 4_000,
      });
      // Cue covers the card; status stays in the control row (never a modal).
      await expect(page.getByTestId('laterality-reshuffle')).toBeVisible();
      await expect(page.getByTestId('loading-card')).toBeVisible();
      await expect(page.getByTestId('laterality-control')).toHaveAttribute('aria-busy', 'true');
      await disableMotionCss(page);
      await capture(page, testInfo, {
        screen: 'status',
        state: 'neighbourhood-loading',
        locale,
      });
    });
  }

  test('fetch failure status line + Retry keeps the card (Lz-38)', async ({ page }, testInfo) => {
    // First relationships call = single-card deck; every later call aborts so prefetch
    // surfaces fetchFailed in the control row without wiping history.
    await preparePage(page);
    let calls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: readRelFixture('loading-deck-en.json'),
        });
        return;
      }
      await route.abort('failed');
    });
    await page.goto('/?canonicalConcept=loading-deck', { waitUntil: 'domcontentloaded' });
    await settleAfterNavigation(page, { skipNetworkIdle: true });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(1);

    await expect(page.getByTestId('deck-status-line')).toContainText(
      /Couldn't load the next idea/i,
      { timeout: 8_000 },
    );
    const retry = page.getByTestId('deck-status-retry');
    await expect(retry).toBeVisible();
    await expect(retry).toHaveAttribute('aria-label', /Retry/i);
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await expect(page.getByTestId('loading-card')).toHaveCount(0);
    await expect(page.getByTestId('coach-tip-slot')).toHaveCount(0);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'fetch-failed', locale: 'en' });
  });

  test('fetch failure status line ES (Lz-38)', async ({ page }, testInfo) => {
    await preparePage(page);
    let calls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: readRelFixture('loading-deck-es.json'),
        });
        return;
      }
      await route.abort('failed');
    });
    await page.goto('/?canonicalConcept=loading-deck&locale=es', {
      waitUntil: 'domcontentloaded',
    });
    await settleAfterNavigation(page, { skipNetworkIdle: true });
    await expect(visibleText(page, 'Horizonte')).toBeVisible();
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(1);
    await expect(page.getByTestId('deck-status-line')).toContainText(
      /No se pudo cargar la siguiente idea/i,
      { timeout: 8_000 },
    );
    await expect(page.getByTestId('deck-status-retry')).toHaveAttribute(
      'aria-label',
      /Reintentar/i,
    );
    await expect(visibleText(page, 'Horizonte')).toBeVisible();
    await expect(page.getByTestId('loading-card')).toHaveCount(0);
    await expect(page.getByTestId('coach-tip-slot')).toHaveCount(0);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'fetch-failed', locale: 'es' });
  });

  test('no next idea after bounded empty retries + Adjust (Lz-38)', async ({ page }, testInfo) => {
    // Prefetch empty batches from the first load-more so the 1.5/3/6s cycle can exhaust.
    await preparePage(page);
    let calls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: readRelFixture('loading-deck-en.json'),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: EMPTY_BATCH_EN,
      });
    });
    await page.goto('/?canonicalConcept=loading-deck', { waitUntil: 'domcontentloaded' });
    await settleAfterNavigation(page, { skipNetworkIdle: true });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    // Prefetch empty cycle must have started (seed + coldStart) before we advance timers.
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(2);

    // 1.5s → 3s → 6s scheduled retries (3 attempts), then No next idea.
    await page.clock.fastForward(1500);
    await page.clock.fastForward(3000);
    await page.clock.fastForward(6000);
    await page.clock.fastForward(50);

    await expect(page.getByTestId('deck-status-line')).toContainText(
      /No next idea at this setting/i,
      { timeout: 8_000 },
    );
    const adjust = page.getByTestId('deck-status-adjust');
    await expect(adjust).toBeVisible();
    await expect(adjust).toHaveAttribute('aria-label', /Adjust/i);
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await expect(page.getByTestId('loading-card')).toHaveCount(0);
    await expect(page.getByTestId('coach-tip-slot')).toHaveCount(0);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'no-next-idea', locale: 'en' });

    // Adjust resets the empty-retry cycle and opens the Laterality sheet (Lz-38 AC).
    const callsBeforeAdjust = calls;
    await adjust.click();
    await expect(page.getByTestId('laterality-sheet')).toBeVisible({ timeout: 4_000 });
    await page.getByTestId('laterality-sheet-row-5').click();
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(callsBeforeAdjust);
  });

  test('no next idea: manual forward swipe resets and refetches (Lz-38)', async ({ page }) => {
    await preparePage(page);
    let calls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: readRelFixture('loading-deck-en.json'),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: EMPTY_BATCH_EN,
      });
    });
    await page.goto('/?canonicalConcept=loading-deck', { waitUntil: 'domcontentloaded' });
    await settleAfterNavigation(page, { skipNetworkIdle: true });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(2);
    await page.clock.fastForward(1500);
    await page.clock.fastForward(3000);
    await page.clock.fastForward(6000);
    await page.clock.fastForward(50);
    await expect(page.getByTestId('deck-status-adjust')).toBeVisible({ timeout: 8_000 });

    const callsBeforeSwipe = calls;
    await swipeForward(page);
    // Manual forward swipe clears the cycle and kicks load-more again.
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(callsBeforeSwipe);
    // End-deck loading may cover the face while the new empty cycle runs — history stays.
    await expect(
      page.getByTestId('loading-card').or(visibleText(page, 'Horizon')),
    ).toBeVisible({ timeout: 4_000 });
  });

  test('no next idea ES (Lz-38)', async ({ page }, testInfo) => {
    await preparePage(page);
    let calls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: readRelFixture('loading-deck-es.json'),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: EMPTY_BATCH_ES,
      });
    });
    await page.goto('/?canonicalConcept=loading-deck&locale=es', {
      waitUntil: 'domcontentloaded',
    });
    await settleAfterNavigation(page, { skipNetworkIdle: true });
    await expect(visibleText(page, 'Horizonte')).toBeVisible();
    await expect.poll(() => calls, { timeout: 8_000 }).toBeGreaterThan(2);
    await page.clock.fastForward(1500);
    await page.clock.fastForward(3000);
    await page.clock.fastForward(6000);
    await page.clock.fastForward(50);
    await expect(page.getByTestId('deck-status-line')).toContainText(
      /No hay siguiente idea con este ajuste/i,
      { timeout: 8_000 },
    );
    await expect(page.getByTestId('deck-status-adjust')).toHaveAttribute(
      'aria-label',
      /Ajustar/i,
    );
    await expect(visibleText(page, 'Horizonte')).toBeVisible();
    await expect(page.getByTestId('coach-tip-slot')).toHaveCount(0);
    await disableMotionCss(page);
    await capture(page, testInfo, { screen: 'status', state: 'no-next-idea', locale: 'es' });
  });

  test('laterality reshuffle failure restores the previous grade; Retry re-attempts the new grade', async ({
    page,
  }) => {
    await preparePage(page);
    let lateralityFiveCalls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      let body: { laterality?: number } = {};
      try {
        body = (route.request().postDataJSON() as { laterality?: number }) ?? {};
      } catch {
        body = {};
      }
      if (body.laterality === 5) {
        lateralityFiveCalls += 1;
        if (lateralityFiveCalls === 1) {
          await route.abort('failed');
          return;
        }
      }
      await route.fallback();
    });
    await page.goto('/?canonicalConcept=mushroom&laterality=1&locale=en', {
      waitUntil: 'domcontentloaded',
    });
    await settleAfterNavigation(page);

    await expect(page.getByTestId('laterality-label')).toContainText('Same domain');
    const rail = page.getByTestId('laterality-rail');
    const box = await rail.boundingBox();
    if (!box) throw new Error('laterality-rail has no bounding box');
    await rail.click({
      position: { x: Math.floor(box.width * 0.92), y: Math.floor(box.height / 2) },
    });

    await page.clock.fastForward(300);
    await page.clock.fastForward(600);
    await page.clock.fastForward(150);

    await expect(page.getByTestId('laterality-label')).toContainText('Same domain');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('deck-status-line')).toContainText(
      /Couldn't load the next idea/i,
    );
    const retry = page.getByTestId('deck-status-retry');
    await expect(retry).toBeVisible();

    const retryFive = page.waitForRequest((req) => {
      if (!req.url().includes('/api/concepts/relationships') || req.method() !== 'POST') {
        return false;
      }
      try {
        return (req.postDataJSON() as { laterality?: number })?.laterality === 5;
      } catch {
        return false;
      }
    });
    await retry.click();
    await retryFive;
    await expect.poll(() => lateralityFiveCalls, { timeout: 8_000 }).toBeGreaterThan(1);
  });

  test('laterality reshuffle timeout restores the previous grade; Retry re-attempts the new grade', async ({
    page,
  }) => {
    await preparePage(page);
    let lateralityFiveCalls = 0;
    await page.route('**/api/concepts/relationships', async (route) => {
      let body: { laterality?: number } = {};
      try {
        body = (route.request().postDataJSON() as { laterality?: number }) ?? {};
      } catch {
        body = {};
      }
      if (body.laterality === 5) {
        lateralityFiveCalls += 1;
        if (lateralityFiveCalls === 1) {
          await new Promise(() => {});
          return;
        }
      }
      await route.fallback();
    });
    await page.goto('/?canonicalConcept=mushroom&laterality=1&locale=en', {
      waitUntil: 'domcontentloaded',
    });
    await settleAfterNavigation(page);

    await expect(page.getByTestId('laterality-label')).toContainText('Same domain');
    const rail = page.getByTestId('laterality-rail');
    const box = await rail.boundingBox();
    if (!box) throw new Error('laterality-rail has no bounding box');
    await rail.click({
      position: { x: Math.floor(box.width * 0.92), y: Math.floor(box.height / 2) },
    });

    await page.clock.fastForward(10_000);
    await page.clock.fastForward(300);
    await page.clock.fastForward(600);
    await page.clock.fastForward(150);

    await expect(page.getByTestId('laterality-label')).toContainText('Same domain');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('deck-status-line')).toContainText(
      /Couldn't load the next idea/i,
    );
    const retry = page.getByTestId('deck-status-retry');
    await expect(retry).toBeVisible();

    const retryFive = page.waitForRequest((req) => {
      if (!req.url().includes('/api/concepts/relationships') || req.method() !== 'POST') {
        return false;
      }
      try {
        return (req.postDataJSON() as { laterality?: number })?.laterality === 5;
      } catch {
        return false;
      }
    });
    await retry.click();
    await retryFive;
    await expect.poll(() => lateralityFiveCalls, { timeout: 8_000 }).toBeGreaterThan(1);
  });
});
