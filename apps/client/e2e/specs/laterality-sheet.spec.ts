import { expect, test, type Page } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

async function openLateralitySheet(page: Page): Promise<void> {
  await page.getByTestId('laterality-label').click();
  await expect(page.getByTestId('laterality-sheet')).toBeVisible();
}

function relationshipsLateralityPosts(page: Page): number[] {
  const grades: number[] = [];
  page.on('request', (req) => {
    if (!req.url().includes('/api/concepts/relationships') || req.method() !== 'POST') {
      return;
    }
    try {
      const body = req.postDataJSON() as { laterality?: number };
      if (typeof body?.laterality === 'number') {
        grades.push(body.laterality);
      }
    } catch {
      // ignore non-JSON
    }
  });
  return grades;
}

/**
 * Lz-31: laterality bottom sheet (guide §12.1).
 * Open captures + B1 behavior: commit, dismiss without change, focus restore.
 */
test.describe('laterality sheet', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`open (${locale})`, async ({ page }, testInfo) => {
      await openApp(page, `canonicalConcept=mushroom&laterality=4&locale=${locale}`);
      await expect(page.getByTestId('laterality-label')).toBeVisible();
      await openLateralitySheet(page);
      await expect(page.getByTestId('laterality-sheet-title')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-title')).toBeFocused();
      await expect(page.getByTestId('laterality-sheet-helper')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-mini-rail')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-mini-rail')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      await expect(page.getByTestId('laterality-sheet-group')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-row-4')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-handle')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-handle-strip')).toBeVisible();

      await capture(page, testInfo, {
        screen: 'laterality-sheet',
        state: 'open',
        locale,
      });
    });
  }

  // Art director: 200% text open capture in ES (rows wrap; list scrolls).
  test('open at 200% text (es)', async ({ page }, testInfo) => {
    await openApp(
      page,
      'canonicalConcept=mushroom&laterality=4&locale=es&e2eTextScale=2',
    );
    await openLateralitySheet(page);
    await expect(page.getByTestId('laterality-sheet')).toBeVisible();
    await expect(page.getByTestId('laterality-sheet-row-4')).toBeVisible();
    await expect(page.getByTestId('laterality-sheet-mini-rail')).toBeVisible();
    await expect(page.getByTestId('laterality-sheet-group')).toBeVisible();

    const title = page.getByTestId('laterality-sheet-title');
    // Wait for measured (or fallback) paint — toBeVisible ignores opacity:0.
    await expect(title).toHaveCSS('opacity', '1');
    await expect(title).toContainText(/Lateralidad/i);

    await capture(page, testInfo, {
      screen: 'laterality-sheet',
      state: 'open-200',
      locale: 'es',
    });
  });

  test('at 200% text the last row is reachable by scrolling', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=4&locale=en&e2eTextScale=2');
    await openLateralitySheet(page);
    const last = page.getByTestId('laterality-sheet-row-5');
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await expect(page.getByTestId('laterality-sheet')).toHaveCount(0);
    await expect(page.getByTestId('laterality-label')).toContainText('Random entry');
  });

  test('tapping row 5 commits Random entry, closes, and POSTs laterality 5', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=4&locale=en');
    await expect(page.getByTestId('laterality-label')).toContainText('Laterality · Provocation');
    await openLateralitySheet(page);

    const relationshipsWithFive = page.waitForRequest((req) => {
      if (!req.url().includes('/api/concepts/relationships') || req.method() !== 'POST') {
        return false;
      }
      try {
        const body = req.postDataJSON() as { laterality?: number };
        return body?.laterality === 5;
      } catch {
        return false;
      }
    });

    await page.getByTestId('laterality-sheet-row-5').click();
    await expect(page.getByTestId('laterality-sheet')).toHaveCount(0);
    await expect(page.getByTestId('laterality-label')).toContainText(
      'Laterality · Random entry',
    );
    await relationshipsWithFive;
  });

  for (const dismiss of [
    {
      name: 'Escape',
      act: async (page: Page) => {
        await page.keyboard.press('Escape');
      },
    },
    {
      name: 'backdrop',
      act: async (page: Page) => {
        // Click the dimmed band above the panel (viewport centre can land on a row
        // when the sheet is tall, e.g. 320 width).
        const backdrop = page.getByTestId('laterality-sheet-backdrop');
        const box = await backdrop.boundingBox();
        if (!box) throw new Error('laterality-sheet-backdrop has no box');
        await page.mouse.click(box.x + box.width / 2, box.y + 12);
      },
    },
    {
      name: 'close',
      act: async (page: Page) => {
        await page.getByTestId('laterality-sheet-close').click();
      },
    },
  ] as const) {
    test(`dismiss via ${dismiss.name} leaves grade unchanged and restores label focus`, async ({
      page,
    }) => {
      await openApp(page, 'canonicalConcept=mushroom&laterality=4&locale=en');
      const label = page.getByTestId('laterality-label');
      await expect(label).toContainText('Laterality · Provocation');
      await openLateralitySheet(page);

      const posts = relationshipsLateralityPosts(page);
      await dismiss.act(page);

      await expect(page.getByTestId('laterality-sheet')).toHaveCount(0);
      await expect(label).toContainText('Laterality · Provocation');
      expect(posts, `no relationships POST after ${dismiss.name} dismiss`).toEqual([]);
      await expect(label).toBeFocused();
    });
  }
});
