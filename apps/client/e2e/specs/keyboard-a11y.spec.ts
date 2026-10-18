import { expect, test } from '@playwright/test';
import { capture, flipCard, isFrontCardFlipped } from '../helpers/capture';
import { cardBackCopy, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-39 keyboard-only smoke + reviewer gates (PRR B1/B2, AD focus/nav captures).
 */
test.describe('keyboard a11y', () => {
  test('nav row stays hidden until a key establishes keyboard modality', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(page.getByTestId('accessible-nav-row')).toHaveCount(0);

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible({ timeout: 5_000 });
  });

  test('ArrowRight / Enter / ArrowLeft complete a non-swipe loop', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');

    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    const surface = page.getByTestId('card-a11y-surface');
    await surface.focus();
    await expect(surface).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(visibleText(page, 'Mycelium')).toBeVisible({ timeout: 10_000 });

    await surface.focus();
    await page.keyboard.press('Enter');
    await expect(cardBackCopy(page)).toBeVisible({ timeout: 10_000 });

    await surface.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(visibleText(page, 'Mushroom')).toBeVisible({ timeout: 10_000 });
  });

  test('Enter on focused back Wikipedia link opens the link and keeps the card flipped', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();

    let wikiRequested = false;
    await page.route('https://en.wikipedia.org/**', async (route) => {
      wikiRequested = true;
      await route.abort();
    });
    await page.evaluate(() => {
      (window as unknown as { __lzWikiOpen?: number }).__lzWikiOpen = 0;
      window.open = () => {
        const w = window as unknown as { __lzWikiOpen?: number };
        w.__lzWikiOpen = (w.__lzWikiOpen ?? 0) + 1;
        return null;
      };
    });

    const wiki = page.getByTestId('card-back-wikipedia');
    await expect(wiki).toBeVisible();
    await wiki.focus();
    await expect(wiki).toBeFocused();
    await page.keyboard.press('Enter');

    await expect
      .poll(async () => {
        const opened = await page.evaluate(
          () => (window as unknown as { __lzWikiOpen?: number }).__lzWikiOpen ?? 0,
        );
        return wikiRequested || opened > 0;
      }, { timeout: 5_000 })
      .toBe(true);

    await expect
      .poll(async () => page.evaluate(isFrontCardFlipped), { timeout: 1_000 })
      .toBe(true);
    await expect(cardBackCopy(page)).toBeVisible();
  });

  test('focus-visible ring appears on the card surface and a nav button', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible();

    const surface = page.getByTestId('card-a11y-surface');
    await surface.focus();
    // Re-assert keyboard modality focus-visible (Tab then focus).
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(surface).toBeFocused();

    const cardOutline = await surface.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, style: cs.outlineStyle, color: cs.outlineColor };
    });
    expect(cardOutline.style === 'solid' || cardOutline.width === '2px').toBeTruthy();
    expect(parseFloat(cardOutline.width)).toBeGreaterThanOrEqual(2);
    // Paper on petrol shell (#F5F1E8) — Ink is invisible there.
    expect(cardOutline.color.replace(/\s/g, '')).toMatch(/245,241,232|#?f5f1e8/i);

    const nextBtn = page.getByTestId('a11y-nav-next');
    await nextBtn.focus();
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    await nextBtn.focus();
    // Force :focus-visible path: keyboard event while focused.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible();
    await nextBtn.focus();
    const btnOutline = await nextBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, style: cs.outlineStyle };
    });
    // Some engines only apply :focus-visible after a real keyboard focus move.
    const hasRing =
      (btnOutline.style === 'solid' && parseFloat(btnOutline.width) >= 2) ||
      (await nextBtn.evaluate((el) => el.matches(':focus-visible')));
    expect(hasRing).toBeTruthy();
  });

  for (const locale of ['en', 'es'] as const) {
    test(`assistive nav row capture (${locale})`, async ({ page }, testInfo) => {
      const vp = testInfo.project.name;
      // Row-on: 320/390 (prior) + 430/1280 (AD round 2).
      test.skip(
        vp !== '320x568' && vp !== '390x844' && vp !== '430x932' && vp !== '1280x800',
        'AD row-on viewports only',
      );
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}`);
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('accessible-nav-row')).toBeVisible();
      await expect(page.getByTestId('a11y-nav-next')).toBeVisible();
      await capture(page, testInfo, {
        screen: 'accessible-nav',
        state: 'row',
        locale,
      });
    });

    test(`assistive nav row at 200% (${locale})`, async ({ page }, testInfo) => {
      const vp = testInfo.project.name;
      test.skip(vp !== '320x568' && vp !== '390x844', 'AD asked for 320 + 390 @ 200%');
      await openApp(page, `canonicalConcept=mushroom&locale=${locale}&e2eTextScale=2`);
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('accessible-nav-row')).toBeVisible();
      await capture(page, testInfo, {
        screen: 'accessible-nav',
        state: 'row-200',
        locale,
      });
    });
  }

  test('EN: Previous label is whole and visible', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await page.keyboard.press('Tab');
    const prev = page.getByTestId('a11y-nav-previous');
    await expect(prev).toBeVisible();
    await expect(prev).toContainText('Previous');
    const text = await prev.evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(text).toMatch(/Previous/);
    expect(text).not.toMatch(/Prev-\s*ious|…|\.\.\./);
  });

  test('ES at 200%: nav labels stay whole; laterality reachable', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es&e2eTextScale=2');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible();

    for (const [testId, needle] of [
      ['a11y-nav-previous', 'Anterior'],
      ['a11y-nav-next', 'Siguiente'],
      ['a11y-nav-flip', 'Girar'],
      ['a11y-nav-complexity-up', 'Más complejo'],
      ['a11y-nav-complexity-down', 'Más sencillo'],
    ] as const) {
      const btn = page.getByTestId(testId);
      await expect(btn).toContainText(needle);
      const text = await btn.evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' '));
      expect(text, `${testId} missing full label`).toContain(needle);
      expect(text, `${testId} soft-hyphen`).not.toContain('\u00AD');
    }

    const laterality = page.getByTestId('laterality-control');
    await expect(laterality).toBeVisible();
    await laterality.scrollIntoViewIfNeeded();
    await expect(laterality).toBeInViewport();
  });

  test('Motion view close returns focus to the Motion row 10 times (F7)', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=en');
    await page.getByTestId('app-menu-trigger').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await expect(page.getByTestId('app-menu-title')).toBeFocused();
    for (let i = 0; i < 10; i += 1) {
      await page.getByTestId('app-menu-row-motion').click();
      await expect(page.getByTestId('app-menu-motion')).toBeVisible();
      await expect(page.getByTestId('app-menu-title')).toBeFocused();
      await page.getByTestId('app-menu-back').click();
      await expect(page.getByTestId('app-menu-row-motion')).toBeFocused();
    }
  });

  test('focused card + nav button captures', async ({ page }, testInfo) => {
    const vp = testInfo.project.name;
    test.skip(vp !== '390x844', 'one viewport for focus captures');
    await openApp(page, 'canonicalConcept=mushroom');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible();

    const surface = page.getByTestId('card-a11y-surface');
    await surface.focus();
    await expect(surface).toBeFocused();
    await capture(page, testInfo, {
      screen: 'accessible-nav',
      state: 'focus-card',
      locale: 'en',
    });

    const nextBtn = page.getByTestId('a11y-nav-next');
    await nextBtn.focus();
    await expect(nextBtn).toBeFocused();
    await capture(page, testInfo, {
      screen: 'accessible-nav',
      state: 'focus-button',
      locale: 'en',
    });
  });
});

for (const concept of ['mushroom', 'diagram']) {
  test(`rounded keyboard focus survives both card faces (${concept})`, async ({ page }) => {
    await openApp(page, `canonicalConcept=${concept}`);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible();
    const surface = page.getByTestId('card-a11y-surface');
    await expect(surface).toBeVisible();
    for (const face of ['front', 'back']) {
      await page.getByTestId('a11y-nav-flip').focus();
      await expect(surface).toBeVisible();
      const unfocusedBox = await surface.boundingBox();
      expect(unfocusedBox).not.toBeNull();
      expect(unfocusedBox?.height ?? 0, face).toBeGreaterThan(0);
      await surface.focus();
      await expect(surface).toBeFocused();
      const ring = await surface.evaluate((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        const outset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        const clippingAncestors: string[] = [];
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const ancestorStyle = getComputedStyle(parent);
          const ancestorBox = parent.getBoundingClientRect();
          const clips = (overflow: string) => ['hidden', 'clip', 'scroll', 'auto'].includes(overflow);
          if (
            (clips(ancestorStyle.overflowX) &&
              (box.left - outset < ancestorBox.left || box.right + outset > ancestorBox.right)) ||
            (clips(ancestorStyle.overflowY) &&
              (box.top - outset < ancestorBox.top || box.bottom + outset > ancestorBox.bottom))
          ) {
            clippingAncestors.push(parent.getAttribute('data-testid') ?? parent.tagName);
          }
        }
        return {
          visible: el.matches(':focus-visible'),
          radii: [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius,
          ],
          width: style.outlineWidth,
          offset: style.outlineOffset,
          style: style.outlineStyle,
          color: style.outlineColor,
          clippingAncestors,
        };
      });
      expect(ring.visible, face).toBe(true);
      expect(ring.radii, face).toEqual(['22px', '22px', '22px', '22px']);
      expect(ring.width).toBe('2px');
      expect(ring.offset).toBe('2px');
      expect(ring.style).toBe('solid');
      expect(ring.color).toBe('rgb(245, 241, 232)');
      expect(ring.clippingAncestors, face).toEqual([]);
      expect(await surface.boundingBox(), face).toEqual(unfocusedBox);
      if (face === 'front') {
        await page.keyboard.press('Enter');
        await expect(cardBackCopy(page)).toBeVisible();
        await expect(surface.getByTestId('card-back-media')).toHaveCount(concept === 'diagram' ? 1 : 0);
      }
    }

    const next = page.getByTestId('a11y-nav-next');
    await next.focus();
    await expect(next).toBeFocused();
    await expect(next).toHaveCSS('outline-width', '2px');
    await expect(next).toHaveCSS('outline-offset', '2px');
    await expect(next).toHaveCSS('outline-color', 'rgb(245, 241, 232)');
    await page.keyboard.press('Enter');
    await expect(surface).toHaveAttribute('aria-label', concept === 'mushroom' ? 'mycelium' : 'node');
  });
}
