import { expect, type Locator, test } from '@playwright/test';
import { capture, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';
import { expectStatusLineClearOfLaterality } from '../helpers/statusLayout';

type TitleScrollMetrics = {
  titleTop: number;
  faceTop: number;
  faceBottom: number;
  titleBottom: number;
  scrollBottom: number;
  fontSize: number;
  lineHeight: number;
  scrollHeight: number;
  clientHeight: number;
  faceHeight: number;
  visibleTitleH: number;
  overflowY: string;
};

async function readTitleScrollMetrics(title: Locator): Promise<TitleScrollMetrics> {
  return title.evaluate((el) => {
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
      faceHeight: faceBox?.height ?? 0,
      visibleTitleH,
      overflowY: scroll ? getComputedStyle(scroll).overflowY : '',
    };
  });
}

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
  // Wait for face onLayout + overflow top spacer (first paint can show all lines).
  await expect
    .poll(
      async () => {
        const m = await readTitleScrollMetrics(title);
        if (m.lineHeight <= 0 || m.faceHeight <= 0) return false;
        return m.visibleTitleH <= 4 * m.lineHeight + 1;
      },
      { timeout: 5_000 },
    )
    .toBe(true);

  const metrics = await readTitleScrollMetrics(title);

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
 * B1/B2 (#95 PRR): content in the pad band
 * `frontContentFaceH < content ≤ frontFaceH` (~2·facePad).
 *
 * Uses test-only `?e2ePadBand=1` (short title + one facePad bottom bump) so the
 * band does not depend on font-fragile long-label metrics. With
 * `frontNeedsScroll` vs outer `frontFaceH`, scroll stays disabled in this band.
 *
 * Proof (local): fails with frontFaceH mutation (overflowY hidden); passes on PR.
 */
async function assertFrontPadBandReachable(title: Locator): Promise<void> {
  await expect
    .poll(
      async () => {
        const m = await readTitleScrollMetrics(title);
        return (
          m.faceHeight > 0 &&
          m.scrollHeight > m.clientHeight + 0.5 &&
          m.scrollHeight <= m.faceHeight + 0.5
        );
      },
      {
        timeout: 8_000,
        message: 'e2ePadBand content never entered frontContentFaceH < content ≤ frontFaceH',
      },
    )
    .toBe(true);

  const rest = await title.evaluate((el) => {
    const scroll = el.closest('[data-testid="card-front-scroll"]') as HTMLElement | null;
    if (!scroll) {
      return {
        scrollHeight: 0,
        clientHeight: 0,
        faceHeight: 0,
        overflowY: '',
        endBelowFold: false,
      };
    }
    scroll.scrollTop = 0;
    const face = scroll.parentElement;
    const faceH = face?.getBoundingClientRect().height ?? 0;
    const end = scroll.querySelector('[data-testid="card-front-pad-band-end"]');
    const endBox = end?.getBoundingClientRect();
    const scrollBox = scroll.getBoundingClientRect();
    return {
      scrollHeight: scroll.scrollHeight,
      clientHeight: scroll.clientHeight,
      faceHeight: faceH,
      overflowY: getComputedStyle(scroll).overflowY,
      endBelowFold: endBox != null && endBox.bottom > scrollBox.bottom + 1,
    };
  });

  expect(rest.scrollHeight).toBeGreaterThan(rest.clientHeight + 0.5);
  expect(rest.scrollHeight).toBeLessThanOrEqual(rest.faceHeight + 0.5);
  expect(rest.endBelowFold, 'pad-band end marker must sit below the fold at scrollTop 0').toBe(
    true,
  );
  // B2: comparing to outer faceH leaves scroll disabled in this band.
  expect(rest.overflowY, 'frontNeedsScroll must enable scroll in the pad band').not.toBe(
    'hidden',
  );

  const reachable = await title.evaluate((el) => {
    const scroll = el.closest('[data-testid="card-front-scroll"]') as HTMLElement | null;
    if (!scroll) {
      return { ok: false, endBottom: 0, scrollBottom: 0 };
    }
    scroll.scrollTop = scroll.scrollHeight;
    const end = scroll.querySelector('[data-testid="card-front-pad-band-end"]');
    if (!end) {
      return { ok: false, endBottom: 0, scrollBottom: 0 };
    }
    const endBottom = end.getBoundingClientRect().bottom;
    const scrollBottom = scroll.getBoundingClientRect().bottom;
    return {
      ok: endBottom <= scrollBottom + 1,
      endBottom,
      scrollBottom,
    };
  });
  expect(
    reachable.ok,
    `pad-band end not reachable after scroll (endBottom=${reachable.endBottom}, scrollBottom=${reachable.scrollBottom})`,
  ).toBe(true);
}

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

  // PRR B1 @ 3a5ca4d: pad-band case locks frontNeedsScroll vs frontContentFaceH.
  test('pad-band scrollport at 320 via e2ePadBand', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '320x568', 'B2 pad band is sized for 320 facePad');
    // Short title + test-only contentFace+facePad minHeight → stable mid-band.
    await openApp(page, 'canonicalConcept=mushroom&e2ePadBand=1');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('card-front-pad-band-end')).toBeAttached();

    await assertFrontPadBandReachable(title);
  });
});
