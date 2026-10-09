import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import { cardBackCopy, cardBackMedia, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('locale es', () => {
  test('front short label', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await expect(visibleText(page, 'Seta')).toBeVisible();
    await capture(page, testInfo, 'es-card-front-short-label');
  });

  test('back no media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&locale=es');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await capture(page, testInfo, 'es-card-back-no-media');
  });

  test('back with photo', async ({ page }, testInfo) => {
    await openApp(page, 'localizedConcept=Psicodélicos&onlyWithMedia=true&locale=es');
    await expect(visibleText(page, 'Psicodélicos')).toBeVisible();
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, 'es-card-back-with-photo');
  });

  test('laterality sheet open', async () => {
    test.skip(true, 'Laterality sheet UI not on main yet — enable when epic ships the sheet.');
  });
});
