import { expect, test } from '@playwright/test';
import { capture } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('card front', () => {
  test('short label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-front', state: 'short-label', locale: 'en' });
  });

  test('long multi-line label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    // aria-label keeps the unwrapped phrase; display text may include \\n / shrink wraps.
    await expect(title).toHaveAttribute(
      'aria-label',
      /extraordinarily elaborate multidisciplinary conceptual framework/i,
    );
    const text = await title.innerText();
    // Words that fit at ≥24 must not take a visible hyphen (measure regression guard).
    expect(text.replace(/\n/g, '')).toMatch(/multidisciplinary/i);
    expect(text).not.toMatch(/multidisciplinar[iy]-/i);

    // Art director §7.3 / Lz-26: ≤4 lines by shrinking toward 24; long titles rise
    // from the lower-middle anchor so "framework" is never clipped at 100% text.
    // 320 EN lands at ~24 px / ≤4 lines when width allows; else face scrolls.
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    expect(text.replace(/\n/g, '')).toMatch(/framework/i);
    expect(lines.length).toBeLessThanOrEqual(4);

    const visibility = await title.evaluate((el) => {
      const titleBox = el.getBoundingClientRect();
      const face =
        el.closest('[data-testid="card-front-scroll"]')?.parentElement ?? el.parentElement;
      const faceBox = face?.getBoundingClientRect();
      return {
        titleBottom: titleBox.bottom,
        faceBottom: faceBox?.bottom ?? 0,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      };
    });
    expect(visibility.titleBottom).toBeLessThanOrEqual(visibility.faceBottom + 1);
    if (testInfo.project.name === '320x568') {
      // 320 EN: was 32 px / 5 lines / clipped — now ≤4 lines, shrunk, fully visible.
      expect(lines.length).toBeLessThanOrEqual(4);
      expect(visibility.fontSize).toBeLessThan(32);
      expect(visibility.fontSize).toBeGreaterThanOrEqual(24);
    }

    await capture(page, testInfo, { screen: 'card-front', state: 'long-label', locale: 'en' });
  });

  test('spec string Tide', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=tide');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute('aria-label', /^Tide$/i);
    const style = await title.evaluate((el) => getComputedStyle(el).textAlign);
    expect(style).toBe('left');
    await capture(page, testInfo, { screen: 'card-front', state: 'tide', locale: 'en' });
  });

  test('spec string Collective intelligence', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=collective-intelligence');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute('aria-label', /Collective intelligence/i);
    const text = await title.innerText();
    expect(text).not.toMatch(/\.\.\.|…/);
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'collective-intelligence',
      locale: 'en',
    });
  });

  test('spec string Intergenerational transmission of knowledge', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=intergenerational');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute(
      'aria-label',
      /Intergenerational transmission of knowledge/i,
    );
    const text = await title.innerText();
    expect(text).not.toMatch(/\.\.\.|…/);
    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'intergenerational',
      locale: 'en',
    });
  });
});
