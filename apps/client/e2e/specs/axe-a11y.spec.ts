import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-41 AC: axe (web) shows 0 serious/critical on the practice screen and both sheets.
 * Functional-only — no pixel / bbox asserts; captures are AD-only and never fail.
 */

const AXE_FAIL_IMPACTS = new Set(['serious', 'critical']);

async function assertNoSeriousAxe(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blockers = results.violations.filter(
    (v) => v.impact != null && AXE_FAIL_IMPACTS.has(v.impact),
  );
  expect(
    blockers,
    `${context}: ${blockers.map((v) => `${v.id}(${v.impact})`).join(', ') || 'none'}`,
  ).toEqual([]);
}

async function openLateralitySheet(page: Page): Promise<void> {
  await page.getByTestId('laterality-label').click();
  await expect(page.getByTestId('laterality-sheet')).toBeVisible();
}

async function openAppMenu(page: Page): Promise<void> {
  await page.getByTestId('app-menu-trigger').click();
  await expect(page.getByTestId('app-menu')).toBeVisible();
}

test.describe('Lz-41 axe accessibility', () => {
  test('practice screen has 0 serious/critical', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await assertNoSeriousAxe(page, 'practice');
    await capture(page, testInfo, {
      screen: 'a11y-axe',
      state: 'practice',
      locale: 'en',
    });
  });

  test('laterality sheet has 0 serious/critical', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=4');
    await openLateralitySheet(page);
    await assertNoSeriousAxe(page, 'laterality-sheet');
    await capture(page, testInfo, {
      screen: 'a11y-axe',
      state: 'laterality-sheet',
      locale: 'en',
    });
  });

  test('app menu sheet has 0 serious/critical', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await openAppMenu(page);
    await assertNoSeriousAxe(page, 'app-menu');
    await capture(page, testInfo, {
      screen: 'a11y-axe',
      state: 'app-menu',
      locale: 'en',
    });
  });
});

test.describe('Lz-41 sheet focus trap + inert', () => {
  test('Tab stays inside laterality sheet; Escape returns focus', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=4');
    const label = page.getByTestId('laterality-label');
    await openLateralitySheet(page);

    const panel = page.getByTestId('laterality-sheet-panel');
    await expect(panel).toBeVisible();

    // Background practice column must be inert on web.
    const practiceInert = await page.getByTestId('practice-column').evaluate((el) => {
      return el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true';
    });
    expect(practiceInert).toBeTruthy();

    const close = page.getByTestId('laterality-sheet-close');
    await close.focus();
    await expect(close).toBeFocused();

    // Spam Tab — focus must remain inside the panel.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const p = document.querySelector('[data-testid="laterality-sheet-panel"]');
        const active = document.activeElement;
        return Boolean(p && active && p.contains(active));
      });
      expect(inside, `Tab step ${i} left the sheet panel`).toBeTruthy();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('laterality-sheet')).toHaveCount(0);
    await expect(label).toBeFocused();
  });

  test('Tab stays inside app menu; Escape returns to trigger', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    const trigger = page.getByTestId('app-menu-trigger');
    await openAppMenu(page);

    const close = page.getByTestId('app-menu-close');
    await close.focus();
    await expect(close).toBeFocused();

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const p = document.querySelector('[data-testid="app-menu-panel"]');
        const active = document.activeElement;
        return Boolean(p && active && p.contains(active));
      });
      expect(inside, `Tab step ${i} left the menu panel`).toBeTruthy();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('app-menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('Lz-41 200% text + reduced motion', () => {
  test('practice at 200% text stays usable (keyboard loop)', async ({ page }, testInfo) => {
    // Playwright projects already set OS reducedMotion=reduce.
    await openApp(page, 'canonicalConcept=mushroom&e2eTextScale=2');
    await expect(page.getByTestId('card-laterality-group')).toBeVisible();

    const surface = page.getByTestId('card-a11y-surface');
    await surface.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('card-a11y-surface')).toBeVisible();

    await capture(page, testInfo, {
      screen: 'a11y-pass',
      state: 'practice-200-rm',
      locale: 'en',
    });
  });
});
