import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
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

test.describe('card front pattern clearing', () => {
  test('200% long-label at 320: no motif intersects title + 16px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '320x568', 'AD clear assert is for 320 viewport');
    await openApp(page, 'canonicalConcept=long-label&e2eTextScale=2');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    const overlap = await page.evaluate(() => {
      const titleEl = document.querySelector('[data-testid="card-front-title"]');
      const pattern = document.querySelector('[data-testid="card-front-pattern"]');
      if (!titleEl || !pattern) return { ok: false, reason: 'missing nodes' };
      const titleBox = titleEl.getBoundingClientRect();
      const clear = {
        left: titleBox.left - 16,
        top: titleBox.top - 16,
        right: titleBox.right + 16,
        bottom: titleBox.bottom + 16,
      };
      const svg = pattern.querySelector('svg');
      if (!svg) return { ok: false, reason: 'no svg' };
      // Visible motif instances: use/g with data-motif and not display:none
      const nodes = svg.querySelectorAll('[data-motif]');
      const hits: string[] = [];
      nodes.forEach((node) => {
        const el = node as SVGElement;
        if (el.getAttribute('display') === 'none') return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        let bb: DOMRect;
        try {
          bb = el.getBoundingClientRect();
        } catch {
          return;
        }
        if (bb.width < 1 || bb.height < 1) return;
        const intersects =
          bb.left < clear.right &&
          bb.right > clear.left &&
          bb.top < clear.bottom &&
          bb.bottom > clear.top;
        if (intersects) {
          hits.push(el.getAttribute('data-motif') ?? '?');
        }
      });
      return { ok: hits.length === 0, hits: [...new Set(hits)] };
    });

    expect(overlap.ok, `motifs in title+16: ${JSON.stringify(overlap)}`).toBe(true);

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-clear-200',
      locale: 'en',
    });
  });
});
