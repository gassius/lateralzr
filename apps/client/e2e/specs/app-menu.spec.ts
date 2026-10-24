import { expect, test, type Page } from '@playwright/test';
import { SWIPE_COACH_IDLE_MS } from '../../lib/discoveryCoaching';
import { capture, swipeForward } from '../helpers/capture';
import { cardFrontTitle } from '../helpers/locators';
import { openApp, preserveStorageAcrossNextLoad, settleAfterNavigation } from '../helpers/preparePage';

async function openAppMenu(page: Page): Promise<void> {
  await page.getByTestId('app-menu-trigger').click();
  await expect(page.getByTestId('app-menu')).toBeVisible();
}

/**
 * Lz-32: app menu sheet with Replay gesture tips (guide §12.2).
 * Functional behavior + capture-only screenshots — no bbox/layout asserts.
 */
test.describe('app menu', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`open (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await expect(page.getByTestId('app-menu-trigger')).toBeVisible();
      await openAppMenu(page);
      await expect(page.getByTestId('app-menu-title')).toBeVisible();
      await expect(page.getByTestId('app-menu-title')).toBeFocused();
      await expect(page.getByTestId('app-menu-group-settings')).toBeVisible();
      await expect(page.getByTestId('app-menu-group-replay')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-motion')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-label-motion')).toHaveText(
        locale === 'es' ? 'Movimiento' : 'Motion',
      );
      await expect(page.getByTestId('app-menu-row-sound')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-label-sound')).toHaveText(
        locale === 'es' ? 'Sonido' : 'Sound',
      );
      await expect(page.getByTestId('app-menu-row-value-sound')).toHaveText(
        locale === 'es' ? 'Activado' : 'On',
      );
      await expect(page.getByTestId('app-menu-row-reference')).toHaveCount(0);
      await expect(page.getByTestId('app-menu-row-replayTips')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-chevron-replayTips')).toHaveCount(0);
      await expect(page.getByTestId('app-menu-handle')).toBeVisible();
      await expect(page.getByTestId('app-menu-handle-strip')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-label-language')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-value-language')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-chevron-language')).toBeVisible();

      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'open',
        locale,
      });
    });
  }

  // Art director: 200% text open capture in ES (all rows visible).
  test('open at 200% text (es)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es&e2eTextScale=2');
    await openAppMenu(page);
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-language')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-complexity')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-motion')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-sound')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-about')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-replayTips')).toBeVisible();
    await expect(page.getByTestId('app-menu-group-settings')).toBeVisible();
    await expect(page.getByTestId('app-menu-group-replay')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-label-complexity')).toHaveText('Complejidad');
    await expect(page.getByTestId('app-menu-row-label-motion')).toHaveText('Movimiento');
    await expect(page.getByTestId('app-menu-row-value-motion')).toHaveText('Según el sistema');
    await expect(page.getByTestId('app-menu-row-label-sound')).toHaveText('Sonido');
    await expect(page.getByTestId('app-menu-row-value-sound')).toHaveText('Activado');

    await capture(page, testInfo, {
      screen: 'app-menu',
      state: 'open-200',
      locale: 'es',
    });
  });

  test('at 200% text the Complexity last row is reachable by scrolling', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en&e2eTextScale=2');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-complexity').click();
    const last = page.getByTestId('app-menu-complexity-row-5');
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-complexity-rows')).toHaveCount(0);
    await expect(page.getByTestId('app-menu-row-value-complexity')).toBeVisible();
  });

  // AD: Complexity picker radios for Lz-31 parity review.
  for (const locale of ['en', 'es'] as const) {
    test(`complexity picker (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await openAppMenu(page);
      await page.getByTestId('app-menu-row-complexity').click();
      await expect(page.getByTestId('app-menu-complexity-rows')).toBeVisible();
      await expect(page.getByTestId('app-menu-complexity-row-1')).toBeVisible();
      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'complexity-picker',
        locale,
      });
    });
  }

  // AD: Motion picker radios (Lz-46) — System / Reduced / Full.
  for (const locale of ['en', 'es'] as const) {
    test(`motion picker (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await openAppMenu(page);
      await expect(page.getByTestId('app-menu-row-motion')).toBeVisible();
      await page.getByTestId('app-menu-row-motion').click();
      await expect(page.getByTestId('app-menu-motion-rows')).toBeVisible();
      await expect(page.getByTestId('app-menu-motion-row-system')).toBeVisible();
      await expect(page.getByTestId('app-menu-motion-row-reduced')).toBeVisible();
      await expect(page.getByTestId('app-menu-motion-row-full')).toBeVisible();
      await expect(page.getByTestId('app-menu-back')).toBeVisible();
      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'motion-picker',
        locale,
      });
    });
  }

  // Sound 2: Sound / Music / Effects toggles (Music/Effects disabled when master off).
  for (const locale of ['en', 'es'] as const) {
    test(`sound picker (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await openAppMenu(page);
      await expect(page.getByTestId('app-menu-row-sound')).toBeVisible();
      await page.getByTestId('app-menu-row-sound').click();
      await expect(page.getByTestId('app-menu-sound-rows')).toBeVisible();
      await expect(page.getByTestId('app-menu-sound-toggle-sound')).toBeVisible();
      await expect(page.getByTestId('app-menu-sound-toggle-music')).toBeVisible();
      await expect(page.getByTestId('app-menu-sound-toggle-effects')).toBeVisible();
      await expect(page.getByTestId('app-menu-sound-toggle-music')).toBeEnabled();
      await expect(page.getByTestId('app-menu-sound-toggle-effects')).toBeEnabled();
      await expect(page.getByTestId('app-menu-back')).toBeVisible();
      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'sound-picker',
        locale,
      });
    });
  }

  // AD: plain Sound-off capture (en + es). PRR M1: aria-checked stays true while disabled.
  for (const locale of ['en', 'es'] as const) {
    test(`master Sound off disables Music/Effects (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await openAppMenu(page);
      await page.getByTestId('app-menu-row-sound').click();
      await expect(page.getByTestId('app-menu-sound-toggle-sound')).toBeVisible();
      const music = page.getByTestId('app-menu-sound-toggle-music');
      const effects = page.getByTestId('app-menu-sound-toggle-effects');
      await page.getByTestId('app-menu-sound-toggle-sound').click();
      await expect(music).toBeDisabled();
      await expect(effects).toBeDisabled();
      await expect(music).toHaveAttribute('aria-checked', 'true');
      await expect(effects).toHaveAttribute('aria-checked', 'true');
      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'sound-off',
        locale,
      });
      await page.getByTestId('app-menu-sound-toggle-sound').click();
      await expect(music).toBeEnabled();
      await expect(effects).toBeEnabled();
      await expect(music).toHaveAttribute('aria-checked', 'true');
      await expect(effects).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('app-menu-back').click();
      await expect(page.getByTestId('app-menu-row-value-sound')).toHaveText(
        locale === 'es' ? 'Activado' : 'On',
      );
    });
  }

  test('Music-only summary persists after reload', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-sound').click();
    await page.getByTestId('app-menu-sound-toggle-effects').click();
    await page.getByTestId('app-menu-back').click();
    await expect(page.getByTestId('app-menu-row-value-sound')).toHaveText('Music only');

    await preserveStorageAcrossNextLoad(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settleAfterNavigation(page);
    await openAppMenu(page);
    await expect(page.getByTestId('app-menu-row-value-sound')).toHaveText('Music only');
  });

  test('Tab to Effects toggle, Space flips it, and Back returns focus to Sound row', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-sound').click();
    await expect(page.getByTestId('app-menu-sound')).toBeVisible();

    const back = page.getByTestId('app-menu-back');
    await expect(back).toBeVisible();
    await back.focus();
    await expect(back).toBeFocused();

    let landedOnEffects = false;
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
      );
      if (id === 'app-menu-sound-toggle-effects') {
        landedOnEffects = true;
        break;
      }
    }
    expect(landedOnEffects, 'Tab should land on Effects toggle').toBeTruthy();

    await page.keyboard.press('Space');
    await page.getByTestId('app-menu-back').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-value-sound')).toHaveText('Music only');
    await expect(page.getByTestId('app-menu-row-sound')).toBeFocused();
  });

  test('picking Reduced updates the Motion row and persists after reload', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-motion').click();
    await expect(page.getByTestId('app-menu-motion-row-reduced')).toBeVisible();
    await page.getByTestId('app-menu-motion-row-reduced').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-value-motion')).toHaveText('Reduced');

    await preserveStorageAcrossNextLoad(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settleAfterNavigation(page);
    await openAppMenu(page);
    await expect(page.getByTestId('app-menu-row-value-motion')).toHaveText('Reduced');
  });

  // PRR B1: selecting a Motion preference must not steal focus back to header Back.
  test('Tab to a Motion row, select it, and keep focus on the Motion menu row', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-motion').click();
    await expect(page.getByTestId('app-menu-motion')).toBeVisible();

    // Start from Back (known host), then Tab to Reduced (keyboard-only select).
    const back = page.getByTestId('app-menu-back');
    await expect(back).toBeVisible();
    await back.focus();
    await expect(back).toBeFocused();

    let landedOnReduced = false;
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
      );
      if (id === 'app-menu-motion-row-reduced') {
        landedOnReduced = true;
        break;
      }
    }
    expect(landedOnReduced, 'Tab should land on Reduced Motion row').toBeTruthy();

    // Space activates role=radio; no click fallback (PRR).
    await page.keyboard.press('Space');

    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-back')).toHaveCount(0);
    await expect(page.getByTestId('app-menu-row-value-motion')).toHaveText('Reduced');

    // Consecutive rAF frames on the Motion row; arm after focus arrives, then
    // reject on any leave (old unstable onBack). No sleep (PRR).
    await page.waitForFunction(() => {
      const targetTestId = 'app-menu-row-motion';
      const needed = 30;
      return new Promise<boolean>((resolve, reject) => {
        let consecutive = 0;
        let armed = false;
        const tick = () => {
          const onTarget =
            (document.activeElement as HTMLElement | null)?.dataset?.testid ===
            targetTestId;
          if (!onTarget) {
            if (armed) {
              reject(
                new Error(`focus left ${targetTestId} after ${consecutive} frames`),
              );
              return;
            }
            requestAnimationFrame(tick);
            return;
          }
          armed = true;
          consecutive += 1;
          if (consecutive >= needed) {
            resolve(true);
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
  });

  test('opening Language picker moves focus to the title (F7)', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-language').click();
    await expect(page.getByTestId('app-menu-language')).toBeVisible();
    await expect(page.getByTestId('app-menu-title')).toBeFocused();
    await expect(page.getByTestId('app-menu-back')).toBeVisible();
  });

  test('closing Motion view returns focus to the Motion row 10 times (F7)', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    for (let i = 0; i < 10; i += 1) {
      await page.getByTestId('app-menu-row-motion').click();
      await expect(page.getByTestId('app-menu-motion')).toBeVisible();
      await expect(page.getByTestId('app-menu-title')).toBeFocused();
      await page.getByTestId('app-menu-back').click();
      await expect(page.getByTestId('app-menu-rows')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-motion')).toBeFocused();
    }
  });

  test('Complexity header back returns to root without closing the sheet', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-complexity').click();
    await expect(page.getByTestId('app-menu-complexity-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-back')).toBeVisible();
    await page.getByTestId('app-menu-back').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await expect(page.getByTestId('app-menu-complexity-rows')).toHaveCount(0);
    await expect(page.getByTestId('app-menu-row-complexity')).toBeVisible();
  });

  test('picking a Complexity grade keeps the current card', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    const before = (await title.innerText()).trim();
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-complexity').click();
    await page.getByTestId('app-menu-complexity-row-5').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await page.getByTestId('app-menu-close').click();
    await expect(title).toHaveText(before);
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
