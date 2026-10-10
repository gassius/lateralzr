import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import { cardBackCopy, cardBackMedia, cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Every soft wrap must follow a visible hyphen or a space (word boundary).
 * Joining lines without that rule would hide bare mid-word splits (M1).
 */
function assertCleanLineBreaks(rendered: string): void {
  for (let i = 0; i < rendered.length; i += 1) {
    if (rendered[i] !== '\n') continue;
    const prev = rendered[i - 1];
    if (prev !== '-' && prev !== ' ') {
      const next = rendered.slice(i + 1, i + 24).replace(/\n/g, '⏎');
      throw new Error(
        `Bare mid-word break before newline (prev=${JSON.stringify(prev)}) at …${rendered.slice(Math.max(0, i - 20), i)}⏎${next}…`,
      );
    }
  }
}

/** Fail if `word` is only recoverable by joining lines without a hyphen. */
function assertNoBareMidWordBreak(rendered: string, word: string): void {
  assertCleanLineBreaks(rendered);
  const lowerWord = word.toLowerCase();
  const lines = rendered.split('\n');
  if (lines.some((line) => line.toLowerCase().includes(lowerWord))) return;

  const viaHyphen = rendered.toLowerCase().replace(/-\n/g, '');
  if (viaHyphen.replace(/\n/g, '').includes(lowerWord)) return;

  throw new Error(
    `Expected "${word}" intact on one line or hyphen-wrapped; got:\n${rendered}`,
  );
}

test.describe('locale es', () => {
  test('front short label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await expect(visibleText(page, 'Seta')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-front', state: 'short-label', locale: 'es' });
  });

  test('front long label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label&locale=es');
    const title = cardFrontTitle(page);
    await expect(title).toBeVisible();
    const text = await title.innerText();
    assertNoBareMidWordBreak(text, 'multidisciplinario');
    assertNoBareMidWordBreak(text, 'extraordinariamente');
    expect(text).not.toMatch(/extraordinariame-/i);
    expect(text.replace(/\n/g, '')).toMatch(/extraordinariamente/i);

    const metrics = await title.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    // Art-director: word fits above the 24 px floor once measure matches RN Web.
    expect(metrics.fontSize).toBeGreaterThan(24);

    await expect(title).toHaveAttribute(
      'aria-label',
      /marco conceptual multidisciplinario extraordinariamente elaborado/i,
    );
    await capture(page, testInfo, { screen: 'card-front', state: 'long-label', locale: 'es' });
  });

  test('back no media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media', locale: 'es' });
  });

  test('back no description fallback copy', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=no-description&locale=es');
    await flipCard(page);
    await expect(page.getByText('Este concepto aún no tiene descripción.')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-description', locale: 'es' });
  });

  test('back with photo', async ({ page }, testInfo) => {
    await openApp(page, 'localizedConcept=Psicodélicos&onlyWithMedia=true&locale=es');
    await expect(visibleText(page, 'Psicodélicos')).toBeVisible();
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-photo', locale: 'es' });
  });
});
