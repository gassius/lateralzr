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
 */
test.describe('app menu', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`open (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await expect(page.getByTestId('app-menu-trigger')).toBeVisible();
      await openAppMenu(page);
      await expect(page.getByTestId('app-menu-title')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-motion')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-replayTips')).toBeVisible();
      await expect(page.getByTestId('app-menu-row-chevron-replayTips')).toHaveCount(0);
      await expect(page.getByTestId('app-menu-handle')).toBeVisible();

      // AD Lz-45: value flush-right beside the chevron (Lz-44 row metric), not after the label.
      const layout = await page.evaluate(() => {
        const label = document.querySelector(
          '[data-testid="app-menu-row-label-language"]',
        ) as HTMLElement | null;
        const value = document.querySelector(
          '[data-testid="app-menu-row-value-language"]',
        ) as HTMLElement | null;
        const chevron = document.querySelector(
          '[data-testid="app-menu-row-chevron-language"]',
        ) as HTMLElement | null;
        if (!label || !value || !chevron) return null;
        const lr = label.getBoundingClientRect();
        const vr = value.getBoundingClientRect();
        const cr = chevron.getBoundingClientRect();
        return {
          labelRight: lr.right,
          valueLeft: vr.left,
          valueRight: vr.right,
          chevronLeft: cr.left,
          sameLine: Math.abs(vr.top - lr.top) < 8,
          gapToChevron: cr.left - vr.right,
          gapFromLabel: vr.left - lr.right,
        };
      });
      expect(layout, 'language label/value/chevron mounted').not.toBeNull();
      expect(layout!.sameLine, `value should share the label line (${JSON.stringify(layout)})`).toBe(
        true,
      );
      expect(
        layout!.gapToChevron,
        `value should sit flush-right beside chevron (${JSON.stringify(layout)})`,
      ).toBeLessThan(20);
      expect(
        layout!.gapFromLabel,
        `value must not sit immediately after the label (${JSON.stringify(layout)})`,
      ).toBeGreaterThan(24);

      await capture(page, testInfo, {
        screen: 'app-menu',
        state: 'open',
        locale,
      });
    });
  }

  // Art director: 200% text open captures at 320 and 390 in ES (all rows visible).
  test('open at 200% text (es)', async ({ page }, testInfo) => {
    const vp = testInfo.project.name;
    test.skip(vp !== '320x568' && vp !== '390x844', 'AD asked for 320 + 390 only');
    await openApp(page, 'canonicalConcept=mushroom&locale=es&e2eTextScale=2');
    await openAppMenu(page);
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-language')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-complexity')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-motion')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-about')).toBeVisible();
    await expect(page.getByTestId('app-menu-row-replayTips')).toBeVisible();

    // PRR B3/B4: labels wrap at spaces (no horizontal overflow); Complejidad stays one line.
    if (vp === '320x568') {
      const fits = await page.evaluate(() => {
        const keys = ['language', 'complexity', 'motion', 'about', 'replayTips'];
        return keys.map((key) => {
          const row = document.querySelector(
            `[data-testid="app-menu-row-${key}"]`,
          ) as HTMLElement | null;
          const label = document.querySelector(
            `[data-testid="app-menu-row-label-${key}"]`,
          ) as HTMLElement | null;
          if (!row || !label) return { key, ok: false, lineCount: 0, text: '' };
          const range = document.createRange();
          range.selectNodeContents(label);
          const lineCount = Array.from(range.getClientRects()).filter((r) => r.width > 0).length;
          return {
            key,
            ok: label.scrollWidth <= row.clientWidth + 1,
            scrollWidth: label.scrollWidth,
            rowWidth: row.clientWidth,
            lineCount,
            text: (label.textContent ?? '').trim(),
          };
        });
      });
      for (const row of fits) {
        expect(row.ok, `${row.key} label overflows row (${JSON.stringify(row)})`).toBe(true);
      }
      const complexity = fits.find((r) => r.key === 'complexity');
      expect(complexity?.text).toBe('Complejidad');
      expect(
        complexity?.lineCount,
        `Complejidad must render on one line (${JSON.stringify(complexity)})`,
      ).toBe(1);

      // Value stacks under the label, left-aligned (only when wrapped).
      const stackedRows = await page.evaluate(() => {
        const keys = ['complexity', 'motion'] as const;
        return keys.map((key) => {
          const label = document.querySelector(
            `[data-testid="app-menu-row-label-${key}"]`,
          ) as HTMLElement | null;
          const value = document.querySelector(
            `[data-testid="app-menu-row-value-${key}"]`,
          ) as HTMLElement | null;
          if (!label || !value) return { key, ok: false };
          const lr = label.getBoundingClientRect();
          const vr = value.getBoundingClientRect();
          return {
            key,
            labelText: (label.textContent ?? '').trim(),
            valueText: (value.textContent ?? '').trim(),
            stacked: vr.top >= lr.bottom - 2,
            leftAligned: Math.abs(vr.left - lr.left) <= 2,
          };
        });
      });
      for (const row of stackedRows) {
        expect(row.stacked, `${row.key} value should stack (${JSON.stringify(row)})`).toBe(true);
        expect(
          row.leftAligned,
          `${row.key} stacked value should be left-aligned (${JSON.stringify(row)})`,
        ).toBe(true);
      }
      const motion = stackedRows.find((r) => r.key === 'motion');
      expect(motion?.labelText).toBe('Movimiento');
      expect(motion?.valueText).toBe('Según el sistema');
    }

    await capture(page, testInfo, {
      screen: 'app-menu',
      state: 'open-200',
      locale: 'es',
    });
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

  test('opening Language picker moves focus into the view', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await openAppMenu(page);
    await page.getByTestId('app-menu-row-language').click();
    await expect(page.getByTestId('app-menu-language')).toBeVisible();
    // Shared Sheet header back (Language + Complexity).
    await expect(page.getByTestId('app-menu-back')).toBeFocused();
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
