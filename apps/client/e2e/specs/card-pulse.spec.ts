import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { cardFrontPattern, visibleText } from '../helpers/locators';
import { expectPatternRendered } from '../helpers/patternRender';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-40 connector pulse — structural only.
 * Peak/live opacity timing left to Critiquito screenshots, not hard asserts.
 * Pattern raster asserts use rendered output (img/svg), not `#connectors` DOM.
 */
test.describe('card front connector pulse', () => {
  test('pulse layer renders connectors (e2ePulsePeak)', async ({ page }, testInfo) => {
    await openApp(
      page,
      'canonicalConcept=mushroom&patternVariant=1&e2ePulsePeak=1',
    );
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(1);
    await expectPatternRendered(page);

    // AD-only artifact for Critiquito — settle/baseline noise must not fail CI.
    try {
      await capture(page, testInfo, {
        screen: 'card-front',
        state: 'pattern-pulse-peak',
        locale: 'en',
      });
    } catch (err) {
      testInfo.annotations.push({
        type: 'ad-capture-soft',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  });

  test('glow scheduler stays off under OS reduced motion', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-idle')).toHaveCount(1);
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(0);
    await expectPatternRendered(page);
  });
});

test.describe('card front connector pulse — Motion reduced', () => {
  // Project default lives on `contextOptions.reducedMotion`; the first-class
  // option alone does not override it.
  test.use({
    reducedMotion: 'no-preference',
    contextOptions: { reducedMotion: 'no-preference' },
  });

  test('glow stays off when Motion is Reduced', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await page.getByTestId('app-menu-trigger').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await page.getByTestId('app-menu-row-motion').click();
    await page.getByTestId('app-menu-motion-row-reduced').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await page.getByTestId('app-menu-close').click();
    await expect(page.getByTestId('app-menu')).toHaveCount(0);
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-idle')).toHaveCount(1);
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(0);
    await expectPatternRendered(page);
  });

  test('glow is armed under no-preference Motion system', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(1);
    await expect(page.getByTestId('card-front-pulse-idle')).toHaveCount(0);
    await expectPatternRendered(page);
  });
});
