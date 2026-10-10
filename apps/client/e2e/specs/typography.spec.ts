import { expect, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-22: art-director captures for v3.3 type roles on non-card chrome,
 * plus a 200% text-scale pass via test-only `e2eTextScale` (joint fontSize+lineHeight).
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
    expect(text.replace(/\n/g, '')).toMatch(/framework/i);

    // Carlos / AD (#95): teal floor 24 (display ≥48 at 200%); wrap toward ≤4 lines,
    // then face scroll — never shrink below 24 to preserve large-text settings.
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    const visibility = await title.evaluate((el) => {
      const titleBox = el.getBoundingClientRect();
      const scroll = el.closest('[data-testid="card-front-scroll"]');
      const face = scroll?.parentElement ?? el.parentElement;
      const faceBox = face?.getBoundingClientRect();
      const scrollEl = scroll as HTMLElement | null;
      return {
        titleTop: titleBox.top,
        faceTop: faceBox?.top ?? 0,
        faceBottom: faceBox?.bottom ?? 0,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        scrollHeight: scrollEl?.scrollHeight ?? 0,
        clientHeight: scrollEl?.clientHeight ?? 0,
      };
    });
    // Layout size 24 × e2eTextScale 2 → displayed ≥48.
    expect(visibility.fontSize).toBeGreaterThanOrEqual(48);
    expect(visibility.titleTop).toBeGreaterThanOrEqual(visibility.faceTop - 1);
    if (visibility.scrollHeight > visibility.clientHeight + 1) {
      // Overflow scrolls — last line may sit below the fold, not clipped away.
      expect(visibility.scrollHeight).toBeGreaterThan(visibility.clientHeight);
    } else {
      expect(lines.length).toBeLessThanOrEqual(4);
    }

    await capture(page, testInfo, {
      screen: 'typography',
      state: 'long-label-200',
      locale: 'en',
    });
  });

  test('long-label front at 200% e2e text scale (es)', async ({ page }, testInfo) => {
    // Longest ES label — AD minor on #95; capture at least at 320.
    await openApp(page, 'canonicalConcept=long-label&locale=es&e2eTextScale=2');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute(
      'aria-label',
      /marco conceptual multidisciplinario extraordinariamente elaborado/i,
    );
    const text = await title.innerText();
    expect(text).not.toMatch(/\.\.\.|…/);
    expect(text.replace(/\n/g, '')).toMatch(/elaborado/i);

    const visibility = await title.evaluate((el) => {
      const titleBox = el.getBoundingClientRect();
      const scroll = el.closest('[data-testid="card-front-scroll"]');
      const face = scroll?.parentElement ?? el.parentElement;
      const faceBox = face?.getBoundingClientRect();
      const scrollEl = scroll as HTMLElement | null;
      return {
        titleTop: titleBox.top,
        faceTop: faceBox?.top ?? 0,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        scrollHeight: scrollEl?.scrollHeight ?? 0,
        clientHeight: scrollEl?.clientHeight ?? 0,
      };
    });
    expect(visibility.fontSize).toBeGreaterThanOrEqual(48);
    expect(visibility.titleTop).toBeGreaterThanOrEqual(visibility.faceTop - 1);

    await capture(page, testInfo, {
      screen: 'typography',
      state: 'long-label-200',
      locale: 'es',
    });
  });
});
