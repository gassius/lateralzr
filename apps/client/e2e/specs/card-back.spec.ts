import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import {
  cardBackCopy,
  cardBackMedia,
  cardBackTitle,
  cardFrontTitle,
  visibleText,
} from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('card back', () => {
  test('no media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(page.getByTestId('card-back-media')).toHaveCount(0);
    await expect(cardBackTitle(page)).toHaveCount(0);
    await expect(page.getByTestId('card-back-wiki')).toBeVisible();
    await expect(page.getByLabel('About Mushroom')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media', locale: 'en' });
  });

  test('no description fallback copy', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=no-description');
    await flipCard(page);
    await expect(
      page.getByText("There isn't a description for this concept yet."),
    ).toBeVisible();
    await expect(page.getByTestId('card-back-wiki')).toHaveCount(0);
    await capture(page, testInfo, { screen: 'card-back', state: 'no-description', locale: 'en' });
  });

  test('long description scrolls without flipping', async ({ page }) => {
    await openApp(page, 'canonicalConcept=long-description');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    const copy = cardBackCopy(page);
    const box = await copy.boundingBox();
    if (!box) throw new Error('card-back-copy has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    // Still on the back — scroll must not fire the flip tap.
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(visibleText(page, 'Long-description')).toHaveCount(0);
  });

  test('with photo', async ({ page }, testInfo) => {
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true');
    await expect(visibleText(page, 'Psychedelics')).toBeVisible();
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-photo', locale: 'en' });
  });

  test('with diagram (direct deep link)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=diagram&onlyWithMedia=true');
    // Front title may wrap with \\n; match the unwrapped aria-label.
    await expect(cardFrontTitle(page)).toHaveAttribute('aria-label', /schematic lattice/i);
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-diagram', locale: 'en' });
  });

  test('with transparent media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=transparent&onlyWithMedia=true');
    await expect(cardFrontTitle(page)).toHaveAttribute('aria-label', /amber cutout/i);
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-transparent', locale: 'en' });
  });
});

