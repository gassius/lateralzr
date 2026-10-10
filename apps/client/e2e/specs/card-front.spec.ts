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

    // Art director §7.3 / Lz-26: prefer ≤4 lines by shrinking toward 24; long titles
    // rise from the lower-middle anchor so "framework" is never clipped at 100% text.
    // 320 EN still needs 5 lines at the 24 floor (words won't pair); 390 fits in 4.
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    expect(text.replace(/\n/g, '')).toMatch(/framework/i);

    const visibility = await title.evaluate((el) => {
      const titleBox = el.getBoundingClientRect();
      const face =
        el.closest('[data-testid="card-front-scroll"]')?.parentElement ?? el.parentElement;
      const faceBox = face?.getBoundingClientRect();
      return {
        titleBottom: titleBox.bottom,
        faceBottom: faceBox?.bottom ?? 0,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        lineCount: el.innerText.split('\n').filter((l) => l.trim().length > 0).length,
      };
    });
    expect(visibility.titleBottom).toBeLessThanOrEqual(visibility.faceBottom + 1);
    if (lines.length > 4) {
      // Only acceptable when already at the 24 floor after the max-lines shrink loop.
      expect(visibility.fontSize).toBe(24);
    } else {
      expect(lines.length).toBeLessThanOrEqual(4);
    }
    if (testInfo.project.name === '320x568') {
      // 320 EN: was 32 px / 5 lines / clipped — must shrink and stay fully visible.
      expect(visibility.fontSize).toBeLessThan(32);
      expect(visibility.fontSize).toBeGreaterThanOrEqual(24);
      expect(visibility.titleBottom).toBeLessThanOrEqual(visibility.faceBottom + 1);
    }
    if (testInfo.project.name === '390x844') {
      expect(lines.length).toBeLessThanOrEqual(4);
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
