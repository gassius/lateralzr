import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import { cardBackCopy, cardBackMedia, cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/** Fail if `word` appears split across a line break without a preceding `-`. */
function assertNoBareMidWordBreak(rendered: string, word: string): void {
  const compact = rendered.replace(/\n/g, '');
  if (compact.toLowerCase().includes(word.toLowerCase())) return;
  const lower = rendered.toLowerCase();
  const target = word.toLowerCase();
  // Allow visible-hyphen wraps: "multi-\ndisciplinario" → joined with hyphen kept.
  const dehyphenated = lower.replace(/-\n/g, '').replace(/-/g, '');
  if (dehyphenated.includes(target)) return;
  throw new Error(
    `Expected "${word}" intact or hyphen-wrapped; got rendered title:\n${rendered}`,
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
    // Lz-26: no mid-word break without a visible hyphen (320 ES is the art-director check).
    const text = await title.innerText();
    assertNoBareMidWordBreak(text, 'multidisciplinario');
    assertNoBareMidWordBreak(text, 'extraordinariamente');
    // Words that fit at 24 px must stay whole (art-director blocker on 1e6ac7a).
    expect(text).not.toMatch(/extraordinariame-/i);
    expect(text.replace(/\n/g, '')).toMatch(/extraordinariamente/i);
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
