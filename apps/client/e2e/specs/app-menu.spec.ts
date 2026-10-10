import { expect, test, type Page } from '@playwright/test';
import { SWIPE_COACH_IDLE_MS } from '../../lib/discoveryCoaching';
import { capture, swipeForward } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

async function openAppMenu(page: Page): Promise<void> {
  await page.getByTestId('app-menu-trigger').click();
  await expect(page.getByTestId('app-menu')).toBeVisible();
}

/**
 * Lz-32: app menu sheet with Replay gesture tips (guide §12.2).
 */
test.describe('app menu', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`open (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await expect(page.getByTestId('app-menu-trigger')).toBeVisible();
      await openAppMenu(page);
      await expect(page.getByTestId('app-menu-title')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-replayTips')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-chevron-replayTips')).toHaveCount(0);
      await expect(page.getByTestId('app-menu-handle')).toBeVisible();

      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'open',
        locale,
      });
    });
  }

  // Art director: 200% text open captures at 320 and 390 in ES.
  test('open at 200% text (es)', async ({ page }, testInfo) => {
    const vp = testInfo.project.name;
    test.skip(vp !== '320x568' && vp !== '390x844', 'AD asked for 320 + 390 only');
    await openApp(page, 'canonicalConcept=mushroom&locale=es&e2eTextScale=2');
    await openAppMenu(page);
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-replayTips')).toBeVisible();
    await capture(page, testInfo, {
      screen: 'app-menu',
      state: 'open-200',
      locale: 'es',
    });
  });

  test('Replay gesture tips restarts coaching from the current card', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    const trigger = page.getByTestId('app-menu-trigger');

    // Past card 0 so a card-0-only reset would leave coaching silent.
    await swipeForward(page, 'Mycelium');
    await openAppMenu(page);

    await page.getByTestId('app-menu-row-replayTips').click();
    await expect(page.getByTestId('app-menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.clock.fastForward(SWIPE_COACH_IDLE_MS);
    await expect(page.getByTestId('coach-hint')).toBeVisible({ timeout: 5_000 });
  });

  for (const dismiss of [
    {
      name: 'Escape',
      act: async (page: Page) => {
        // Focus must leave the trigger before Escape so return-focus is proven (m1).
        const close = page.getByTestId('app-menu-close');
        await close.focus();
        await expect(close).toBeFocused();
        await page.keyboard.press('Escape');
      },
    },
    {
      name: 'backdrop',
      act: async (page: Page) => {
        const backdrop = page.getByTestId('app-menu-backdrop');
        const box = await backdrop.boundingBox();
        if (!box) throw new Error('app-menu-backdrop has no box');
        await page.mouse.click(box.x + box.width / 2, box.y + 12);
      },
    },
    {
      name: 'close',
      act: async (page: Page) => {
        await page.getByTestId('app-menu-close').click();
      },
    },
  ] as const) {
    test(`dismiss via ${dismiss.name} restores trigger focus`, async ({ page }) => {
      await openApp(page, 'canonicalConcept=mushroom&locale=en');
      const trigger = page.getByTestId('app-menu-trigger');
      await openAppMenu(page);

      await dismiss.act(page);

      await expect(page.getByTestId('app-menu')).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
});
