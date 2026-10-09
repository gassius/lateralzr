import { expect, test } from '@playwright/test';
import { capture, flipCard, swipeForward } from '../helpers/capture';
import { cardBackCopy, cardBackMedia, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('card back', () => {
  test('no media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(page.getByTestId('card-back-media')).toHaveCount(0);
    await capture(page, testInfo, 'card-back-no-media');
  });

  test('with photo', async ({ page }, testInfo) => {
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true');
    await expect(visibleText(page, 'Psychedelics')).toBeVisible();
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, 'card-back-with-photo');
  });

  test('with diagram (next card media)', async ({ page }, testInfo) => {
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true');
    await swipeForward(page);
    await expect(visibleText(page, 'Perception')).toBeVisible({ timeout: 8_000 });
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, 'card-back-with-diagram');
  });
});
