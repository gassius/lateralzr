import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
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
      .poll(
        async () =>
          page.evaluate(() => {
            const nodes = Array.from(document.querySelectorAll('[data-testid="card-back-copy"]'));
            return nodes.some((el) => {
              let p: HTMLElement | null = el as HTMLElement;
              while (p) {
                if (getComputedStyle(p).opacity === '0') return false;
                p = p.parentElement;
              }
              return true;
            });
          }),
        { timeout: 1_000 },
      )
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
      test.skip(vp !== '320x568' && vp !== '390x844', 'AD asked for 320 + 390 only');
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
      test.skip(vp !== '320x568' && vp !== '390x844', 'AD asked for 320 + 390 only');
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
