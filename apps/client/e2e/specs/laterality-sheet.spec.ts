import { expect, test, type Locator, type Page } from '@playwright/test';
import { capture } from '../helpers/capture';
import { openApp } from '../helpers/preparePage';

async function openLateralitySheet(page: Page): Promise<void> {
  await page.getByTestId('laterality-label').click();
  await expect(page.getByTestId('laterality-sheet')).toBeVisible();
}

/**
 * Assert rendered title geometry (soft wraps are invisible to innerText).
 * Pass when: height ≤ lineHeight×1.1 (one line) OR each visual line ends in `-`/space
 * (Range.getClientRects), and scrollWidth ≤ clientWidth.
 */
async function assertSheetTitleGeometry(title: Locator): Promise<void> {
  const report = await title.evaluate((host) => {
    const findTextEl = (root: Element): HTMLElement | null => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if ((node.textContent ?? '').trim().length > 0) {
          return node.parentElement;
        }
        node = walker.nextNode();
      }
      return root instanceof HTMLElement ? root : null;
    };

    const el = findTextEl(host);
    if (!el) {
      return { ok: false as const, reason: 'no text element under title host' };
    }

    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      return { ok: false as const, reason: `bad lineHeight: ${style.lineHeight}` };
    }

    const height = el.getBoundingClientRect().height;
    const { scrollWidth, clientWidth } = el;
    if (scrollWidth > clientWidth + 1) {
      return {
        ok: false as const,
        reason: `overflow scrollWidth=${scrollWidth} clientWidth=${clientWidth}`,
        height,
        lineHeight,
        scrollWidth,
        clientWidth,
      };
    }

    const oneLine = height <= lineHeight * 1.1 + 0.5;
    if (oneLine) {
      return {
        ok: true as const,
        height,
        lineHeight,
        scrollWidth,
        clientWidth,
        oneLine: true,
      };
    }

    // Multi-line: every visual line (except the last) must end in `-` or space.
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      textNodes.push(n as Text);
      n = walker.nextNode();
    }
    const fullText = textNodes.map((t) => t.textContent ?? '').join('');
    const range = document.createRange();
    type CharRect = { index: number; top: number; char: string };
    const chars: CharRect[] = [];
    let globalIndex = 0;
    for (const textNode of textNodes) {
      const value = textNode.textContent ?? '';
      for (let i = 0; i < value.length; i += 1) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const rects = range.getClientRects();
        if (rects.length === 0) {
          globalIndex += 1;
          continue;
        }
        chars.push({
          index: globalIndex,
          top: Math.round(rects[0].top),
          char: value[i] ?? '',
        });
        globalIndex += 1;
      }
    }

    if (chars.length === 0) {
      return { ok: false as const, reason: 'no client rects for title text', height, lineHeight };
    }

    const lineEndChars: string[] = [];
    for (let i = 0; i < chars.length - 1; i += 1) {
      if (chars[i].top !== chars[i + 1].top) {
        lineEndChars.push(chars[i].char);
      }
    }

    const badEnds = lineEndChars.filter((ch) => ch !== '-' && ch !== ' ');
    if (badEnds.length > 0) {
      return {
        ok: false as const,
        reason: `bare mid-word visual wrap; line ends=${JSON.stringify(lineEndChars)} text=${JSON.stringify(fullText)}`,
        height,
        lineHeight,
        scrollWidth,
        clientWidth,
        oneLine: false,
      };
    }

    return {
      ok: true as const,
      height,
      lineHeight,
      scrollWidth,
      clientWidth,
      oneLine: false,
      lineEndChars,
    };
  });

  expect(report, JSON.stringify(report)).toMatchObject({ ok: true });
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
      await expect(page.getByTestId('laterality-sheet-row-4')).toBeVisible();
      await expect(page.getByTestId('laterality-sheet-handle')).toBeVisible();

      await capture(page, testInfo, {
        screen: 'laterality-sheet',
        state: 'open',
        locale,
      });
    });
  }

  // Art director: 200% text open captures at 320 and 390 in ES (rows wrap; list scrolls).
  // Follow-up: title must not bare-split as "Lateralida / d" at 320×200%.
  test('open at 200% text (es)', async ({ page }, testInfo) => {
    const vp = testInfo.project.name;
    test.skip(vp !== '320x568' && vp !== '390x844', 'AD asked for 320 + 390 only');
    await openApp(
      page,
      'canonicalConcept=mushroom&laterality=4&locale=es&e2eTextScale=2',
    );
    await openLateralitySheet(page);
    await expect(page.getByTestId('laterality-sheet')).toBeVisible();
    await expect(page.getByTestId('laterality-sheet-row-4')).toBeVisible();

    const title = page.getByTestId('laterality-sheet-title');
    // m1: title host stays opacity 0 until measured — wait for the final paint.
    await expect(title).toBeVisible();
    await expect(title).toContainText(/Lateralidad/i);
    await assertSheetTitleGeometry(title);

    await capture(page, testInfo, {
      screen: 'laterality-sheet',
      state: 'open-200',
      locale: 'es',
    });
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
