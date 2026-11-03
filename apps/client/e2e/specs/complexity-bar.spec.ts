import { expect, test, type Page } from '@playwright/test';
import { capture } from '../helpers/capture';
import { visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-67: persistent Complexity bar (guide §9.7).
 * Behaviour + capture-only screenshots — no bbox/pixel layout asserts.
 */
test.describe('complexity bar', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`visible on practice screen (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&complexity=2&locale=${locale}`);
      await expect(page.getByTestId('header-wordmark')).toBeVisible();
      await expect(page.getByTestId('complexity-control')).toBeVisible();
      await expect(page.getByTestId('complexity-rail')).toBeVisible();
      await expect(page.getByTestId('complexity-label')).toBeVisible();
      await expect(page.getByTestId('complexity-label')).toHaveText(
        locale === 'es' ? 'Complejidad 2' : 'Complexity 2',
      );
      await expect(page.getByTestId('laterality-status-band')).toHaveCount(0);
      await capture(page, testInfo, {
        screen: 'complexity-bar',
        state: 'grade-2',
        locale,
      });
    });
  }

  test('chevron opens the Complexity picker; selecting a level updates the label', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom&complexity=2&locale=en');
    await expect(page.getByTestId('complexity-label')).toHaveText('Complexity 2');

    await page.getByTestId('complexity-label').click();
    await expect(page.getByTestId('app-menu-complexity-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-complexity-row-4')).toBeVisible();

    await page.getByTestId('app-menu-complexity-row-4').click();
    await expect(page.getByTestId('app-menu-complexity-rows')).toHaveCount(0);
    await expect(page.getByTestId('complexity-label')).toHaveText('Complexity 4');
    // Picker must not advance the card.
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
  });

  test('label is localized in Spanish', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&complexity=3&locale=es');
    await expect(page.getByTestId('complexity-label')).toHaveText('Complejidad 3');
    await page.getByTestId('complexity-label').click();
    await expect(page.getByTestId('app-menu-complexity-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-title')).toHaveText('Complejidad');
  });

  test('rail tap selects a Complexity level without opening the picker', async ({
    page,
  }: {
    page: Page;
  }) => {
    await openApp(page, 'canonicalConcept=mushroom&complexity=1&locale=en');
    await expect(page.getByTestId('complexity-label')).toHaveText('Complexity 1');

    const rail = page.getByTestId('complexity-rail');
    const box = await rail.boundingBox();
    expect(box, 'complexity-rail bounding box').toBeTruthy();
    if (!box) throw new Error('complexity-rail has no bounding box');
    await rail.click({
      position: { x: Math.floor(box.width * 0.92), y: Math.floor(box.height / 2) },
    });

    await expect(page.getByTestId('complexity-label')).toHaveText('Complexity 5');
    await expect(page.getByTestId('app-menu-complexity-rows')).toHaveCount(0);
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
  });
});
