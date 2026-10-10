import { expect, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';
import { expectStatusLineClearOfLaterality } from '../helpers/statusLayout';

/**
 * Lz-22: art-director captures for v3.3 type roles on non-card chrome,
 * plus a 200% text-scale pass via test-only `e2eTextScale` (joint fontSize+lineHeight).
 */
test.describe('typography', () => {
  test('status loading uses meta-scale status line (no ellipsis)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=loading-deck', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await swipeForward(page);
    const status = page.getByTestId('deck-status-line');
    await expect(status).toBeVisible({ timeout: 8_000 });
    await expect(status).toContainText(/Loading more ideas/i);

    // Meta status line must not ellipsize (wrap is fine on the label row).
    const ellipsized = await status.evaluate((el) => {
      const text = (el.querySelector('[dir], span, div, p') as HTMLElement | null) ?? el;
      return getComputedStyle(text).textOverflow === 'ellipsis';
    });
    expect(ellipsized).toBe(false);
    await expectStatusLineClearOfLaterality(page);

    await capture(page, testInfo, { screen: 'typography', state: 'status-meta', locale: 'en' });
  });

  test('practice chrome at 200% e2e text scale (full frame)', async ({ page }, testInfo) => {
    // Test-only override: multiplies fontSize and lineHeight together (RN joint scale).
    // Do not use documentElement.zoom — it crops the phone frame.
    await openApp(page, 'canonicalConcept=mushroom&e2eTextScale=2');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await capture(page, testInfo, { screen: 'typography', state: 'large-text-200', locale: 'en' });
  });

  test('long-label front at 200% e2e text scale', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label&e2eTextScale=2');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute(
      'aria-label',
      /extraordinarily elaborate multidisciplinary conceptual framework/i,
    );
    const text = await title.innerText();
    expect(text).not.toMatch(/\.\.\.|…/);
    await capture(page, testInfo, {
      screen: 'typography',
      state: 'long-label-200',
      locale: 'en',
    });
  });
});
