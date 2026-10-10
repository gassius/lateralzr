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
import {
  cardBackScroll,
  dragCardBackCopyUp,
  readBackScrollTop,
} from '../helpers/scrollBack';

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
    await expect(cardBackScroll(page)).toBeVisible();

    // Real vertical touch drag on the visible portion of card-back-copy.
    // Chromium mouse-drag does not move overflow:auto scrollTop; CDP touch does.
    // Drag distance exceeds Tap.maxDeltaY(10) so the flip tap must not fire.
    await dragCardBackCopyUp(page, 160);

    await expect(cardBackCopy(page)).toBeVisible();
    await expect(visibleText(page, 'Long-description')).toHaveCount(0);
    expect(await readBackScrollTop(page)).toBeGreaterThan(0);
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

