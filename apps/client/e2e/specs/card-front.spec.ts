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
