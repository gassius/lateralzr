import { expect, type Locator, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-26 / #95 B1+AD: at 200% the title must not mid-glyph clip in the face, and
 * the last line must be reachable via `card-front-scroll`.
 *
 * - At scrollTop 0: visible title height in the scrollport is ≤4 line-heights
 *   (overflowFallback must not paint unlimited lines in the viewport).
 * - If content overflows: scrollTop = scrollHeight, then
 *   title.bottom ≤ scroll.bottom + 1.
 * - If content does not overflow: scrollHeight ≤ clientHeight + 1 and
 *   title.bottom ≤ face.bottom + 1.
 *
 * Mutation: fails with main's ConceptCard/conceptFrontTitle (7-line viewport /
 * mid-glyph cut at 320×200% ES); passes on the PR fix.
 */
async function assertLongLabel200TitleReachable(title: Locator): Promise<void> {
  const metrics = await title.evaluate((el) => {
    const titleBox = el.getBoundingClientRect();
    const scroll = el.closest('[data-testid="card-front-scroll"]') as HTMLElement | null;
    const face = scroll?.parentElement ?? el.parentElement;
    const faceBox = face?.getBoundingClientRect();
    const scrollBox = scroll?.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    const scrollHeight = scroll?.scrollHeight ?? 0;
    const clientHeight = scroll?.clientHeight ?? 0;
    const visibleTop = Math.max(titleBox.top, scrollBox?.top ?? titleBox.top);
    const visibleBottom = Math.min(titleBox.bottom, scrollBox?.bottom ?? titleBox.bottom);
    const visibleTitleH = Math.max(0, visibleBottom - visibleTop);
    return {
      titleTop: titleBox.top,
      faceTop: faceBox?.top ?? 0,
      faceBottom: faceBox?.bottom ?? 0,
      titleBottom: titleBox.bottom,
      scrollBottom: scrollBox?.bottom ?? 0,
      fontSize,
      lineHeight,
      scrollHeight,
      clientHeight,
      visibleTitleH,
    };
  });

  // Layout size 24 × e2eTextScale 2 → displayed ≥48 (never ink-band 12×2).
  expect(metrics.fontSize).toBeGreaterThanOrEqual(48);
  expect(metrics.titleTop).toBeGreaterThanOrEqual(metrics.faceTop - 1);
  expect(metrics.lineHeight).toBeGreaterThan(0);

  // AD: at most 4 whole lines in the title viewport (no unlimited overflowFallback).
  expect(metrics.visibleTitleH).toBeLessThanOrEqual(4 * metrics.lineHeight + 1);

  const overflows = metrics.scrollHeight > metrics.clientHeight + 1;
  if (!overflows) {
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
    expect(metrics.titleBottom).toBeLessThanOrEqual(metrics.faceBottom + 1);
    return;
  }

  const reachable = await title.evaluate((el) => {
    const scroll = el.closest('[data-testid="card-front-scroll"]') as HTMLElement | null;
    if (!scroll) {
      return { ok: false, titleBottom: 0, scrollBottom: 0 };
    }
    scroll.scrollTop = scroll.scrollHeight;
    const titleBottom = el.getBoundingClientRect().bottom;
    const scrollBottom = scroll.getBoundingClientRect().bottom;
    return {
      ok: titleBottom <= scrollBottom + 1,
      titleBottom,
      scrollBottom,
    };
  });
  expect(
    reachable.ok,
    `last title line not reachable after scroll (titleBottom=${reachable.titleBottom}, scrollBottom=${reachable.scrollBottom})`,
  ).toBe(true);
}

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
    // Strip soft-hyphen breaks (`-\n`) so "framewor-\nk" still reads as framework.
    expect(text.replace(/-\n/g, '').replace(/\n/g, '')).toMatch(/framework/i);

    // Carlos / AD (#95): teal floor 24 (display ≥48 at 200%); ≤4 lines in viewport,
    // then face scroll — never shrink below 24. B1: last line must be reachable.
    await assertLongLabel200TitleReachable(title);

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
    expect(text.replace(/-\n/g, '').replace(/\n/g, '')).toMatch(/elaborado/i);

    await assertLongLabel200TitleReachable(title);

    await capture(page, testInfo, {
      screen: 'typography',
      state: 'long-label-200',
      locale: 'es',
    });
  });
});
