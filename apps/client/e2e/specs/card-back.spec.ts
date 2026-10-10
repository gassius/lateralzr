import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import { cardBackCopy, cardBackMedia, cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('card back', () => {
  test('no media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(page.getByTestId('card-back-media')).toHaveCount(0);
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media', locale: 'en' });
  });

  // Art-director: link spacing / body at large text — one viewport is enough.
  test('no media at 200% e2e text scale', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '390x844', 'one viewport covers the 200% back capture');
    await openApp(page, 'canonicalConcept=mushroom&e2eTextScale=2');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(page.getByTestId('card-back-media')).toHaveCount(0);
    await expect(page.getByTestId('card-back-wiki')).toBeVisible();
    // Guard against a byte-identical 100% capture: body must actually scale.
    const description = page.locator('[data-testid="card-back-description"]:visible').first();
    const fontSize = await description.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(34);
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media-200', locale: 'en' });
  });

  test('no description fallback copy', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=no-description');
    await flipCard(page);
    await expect(
      page.getByText("There isn't a description for this concept yet."),
    ).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-description', locale: 'en' });
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

