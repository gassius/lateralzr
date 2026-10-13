import { expect, test } from '@playwright/test';
import { COACH_IDLE_MS } from '../../lib/discoveryCoaching';
import { capture, swipeForward } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

const TIP_TAP_ES = 'Toca para girar la carta';
const TIP_SWIPE_ES = 'Desliza de lado para explorar';
const TIP_COMPLEXITY_ES = 'Desliza arriba o abajo para cambiar la complejidad';

/**
 * Lz-48 §12.3 tip sequence captures (Spanish) + Reduced + 200% text.
 * Functional text asserts only — no tip/card bbox clearance.
 * Playwright projects already set OS reducedMotion=reduce, so tips appear instantly.
 */
test.describe('coach tips (§12.3)', () => {
  test('tipTap in Spanish', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');

    await page.clock.fastForward(COACH_IDLE_MS);
    const hint = page.getByTestId('coach-hint');
    await expect(hint).toBeVisible({ timeout: 5_000 });
    await expect(hint).toContainText(TIP_TAP_ES);
    await capture(page, testInfo, {
      screen: 'coach',
      state: 'tip-tap',
      locale: 'es',
    });
  });

  test('tipSwipe after tap discovery (es)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');

    // Discover tap before tipTap offers so the next idle tip is tipSwipe on this card.
    const surface = page.getByTestId('card-a11y-surface');
    await surface.click();
    await surface.click(); // back to front — tips only arm when unflipped

    await page.clock.fastForward(COACH_IDLE_MS);
    const hint = page.getByTestId('coach-hint');
    await expect(hint).toBeVisible({ timeout: 5_000 });
    await expect(hint).toContainText(TIP_SWIPE_ES);
    await capture(page, testInfo, {
      screen: 'coach',
      state: 'tip-swipe',
      locale: 'es',
    });
  });

  test('tipComplexity after tap+swipe discovery (es)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');

    const surface = page.getByTestId('card-a11y-surface');
    await surface.click();
    await surface.click();
    await swipeForward(page, 'Micelio');

    await page.clock.fastForward(COACH_IDLE_MS);
    const hint = page.getByTestId('coach-hint');
    await expect(hint).toBeVisible({ timeout: 5_000 });
    await expect(hint).toContainText(TIP_COMPLEXITY_ES);
    await capture(page, testInfo, {
      screen: 'coach',
      state: 'tip-complexity',
      locale: 'es',
    });
  });

  test('tipComplexity at 200% text (es)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es&e2eTextScale=2');

    const surface = page.getByTestId('card-a11y-surface');
    await surface.click();
    await surface.click();
    await swipeForward(page, 'Micelio');

    await page.clock.fastForward(COACH_IDLE_MS);
    const hint = page.getByTestId('coach-hint');
    await expect(hint).toBeVisible({ timeout: 5_000 });
    await expect(hint).toContainText(TIP_COMPLEXITY_ES);
    await capture(page, testInfo, {
      screen: 'coach',
      state: 'tip-complexity-200',
      locale: 'es',
    });
  });

  test('tipTap with app Motion=Reduced (es)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await page.getByTestId('app-menu-trigger').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await page.getByTestId('app-menu-row-motion').click();
    await page.getByTestId('app-menu-motion-row-reduced').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await page.getByTestId('app-menu-close').click();
    await expect(page.getByTestId('app-menu')).toHaveCount(0);

    // Replay so idle arms cleanly after menu interaction.
    await page.getByTestId('app-menu-trigger').click();
    await page.getByTestId('app-menu-row-replayTips').click();
    await expect(page.getByTestId('app-menu')).toHaveCount(0);

    await page.clock.fastForward(COACH_IDLE_MS);
    const hint = page.getByTestId('coach-hint');
    await expect(hint).toBeVisible({ timeout: 5_000 });
    await expect(hint).toContainText(TIP_TAP_ES);
    await capture(page, testInfo, {
      screen: 'coach',
      state: 'tip-tap-reduced',
      locale: 'es',
    });
  });
});
