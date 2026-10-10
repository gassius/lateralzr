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

  // Art-director minor: link spacing / scroll at large text — one viewport is enough.
  test('no media at 200% e2e text scale', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '390x844', 'one viewport covers the 200% back capture');
    await openApp(page, 'canonicalConcept=mushroom&e2eTextScale=2');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(page.getByTestId('card-back-media')).toHaveCount(0);
    await expect(page.getByTestId('card-back-wiki')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media-200', locale: 'en' });
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

    // 12px vertical: above Tap.maxDeltaY(10) but under maxDistance(14), so this
    // specifically fails the flip tap via maxDeltaY (not maxDistance alone).
    // A 12px drag does not scroll — only assert still on the back.
    await dragCardBackCopyUp(page, 12);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(visibleText(page, 'Long-description')).toHaveCount(0);

    // 160px vertical CDP touch: scrolls overflow (mouse-drag does not) and also
    // exceeds maxDistance. Assert scrollTop > 0 while remaining on the back.
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

