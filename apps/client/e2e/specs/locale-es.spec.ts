import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import { cardBackCopy, cardBackMedia, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('locale es', () => {
  test('front short label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await expect(visibleText(page, 'Seta')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-front', state: 'short-label', locale: 'es' });
  });

  test('front long label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=long-label&locale=es');
    await expect(
      visibleText(page, /marco conceptual multidisciplinario extraordinariamente elaborado/i),
    ).toBeVisible();
    await capture(page, testInfo, { screen: 'card-front', state: 'long-label', locale: 'es' });
  });

  test('back no media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media', locale: 'es' });
  });

  test('back with photo', async ({ page }, testInfo) => {
    await openApp(page, 'localizedConcept=Psicodélicos&onlyWithMedia=true&locale=es');
    await expect(visibleText(page, 'Psicodélicos')).toBeVisible();
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-photo', locale: 'es' });
  });
});
