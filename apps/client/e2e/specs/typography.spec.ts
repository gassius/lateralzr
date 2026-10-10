import { expect, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-22: art-director captures for v3.3 type roles on non-card chrome,
 * plus a 200% web zoom pass (Engineer Supervisor: root font-size/zoom override).
 */
test.describe('typography', () => {
  test('status loading uses body-scale caption (no ellipsis)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=loading-deck', {
      mock: { delayLoadMoreMs: 120_000 },
      skipNetworkIdle: true,
    });
    await expect(visibleText(page, 'Horizon')).toBeVisible();
    await swipeForward(page);
    const caption = page.getByText(/Loading more ideas/i);
    await expect(caption).toBeVisible({ timeout: 8_000 });

    const truncated = await caption.evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        style.textOverflow === 'ellipsis' ||
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1
      );
    });
    expect(truncated).toBe(false);

    await capture(page, testInfo, { screen: 'typography', state: 'status-body', locale: 'en' });
  });

  test('practice chrome at 200% web zoom', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await page.waitForTimeout(100);

    await capture(page, testInfo, { screen: 'typography', state: 'web-zoom-200', locale: 'en' });
  });
});
