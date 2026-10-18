import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { capture, flipCard, swipeBack, swipeForward } from '../helpers/capture';
import { cardFrontPattern, cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-25 pattern variants — forced via `?patternVariant=1|2|3` on a short title
 * so Critiquito can compare to preview PNGs without long-label clearing.
 * (Fixture label for long-label hashes to edge / variant 3, not descending.)
 */
test.describe('card front pattern', () => {
  test('variant 01 descending current', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.locator('#pattern-variant-0')).toHaveCount(1);
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-01-descending',
      locale: 'en',
    });
  });

  test('variant 02 ascending current', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=tide&patternVariant=2');
    await expect(visibleText(page, 'Tide')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.locator('#pattern-variant-1')).toHaveCount(1);
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-02-ascending',
      locale: 'en',
    });
  });

  test('variant 03 edge current', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=3');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.locator('#pattern-variant-2')).toHaveCount(1);
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-03-edge',
      locale: 'en',
    });
  });
});

/** Resting scrollTop 0 capture for AD viewing — no motif/bbox asserts. */
async function capturePatternClear200(
  page: Page,
  testInfo: TestInfo,
  locale: 'en' | 'es',
): Promise<void> {
  const title = cardFrontTitle(page);
  await expect(title).toBeVisible();
  await expect(cardFrontPattern(page)).toBeAttached();

  await title.evaluate((el) => {
    const scroll = el.closest('[data-testid="card-front-scroll"]') as HTMLElement | null;
    if (scroll) scroll.scrollTop = 0;
  });

  await capture(page, testInfo, {
    screen: 'card-front',
    state: 'pattern-clear-200',
    locale,
  });
}

test.describe('card front pattern stability', () => {
  test('variant stays put after flip and backtrack', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.locator('#pattern-variant-2')).toHaveCount(1);
    await flipCard(page);
    await flipCard(page);
    await expect(page.locator('#pattern-variant-2')).toHaveCount(1);
    await swipeForward(page, 'Mycelium');
    await swipeBack(page, 'Mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.locator('#pattern-variant-2')).toHaveCount(1);
  });
});

test.describe('card front pattern clearing', () => {
  test('200% long-label: clear capture (en)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label&e2eTextScale=2');
    await capturePatternClear200(page, testInfo, 'en');
  });

  test('200% long-label: clear capture (es)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label&locale=es&e2eTextScale=2');
    await expect(cardFrontTitle(page)).toHaveAttribute(
      'aria-label',
      /marco conceptual multidisciplinario extraordinariamente elaborado/i,
    );
    await capturePatternClear200(page, testInfo, 'es');
  });
});
