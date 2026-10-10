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
    // Real pointer drag so RNGH Tap sees maxDeltaY and fails (wheel would never arm Tap).
    const x = box.x + box.width / 2;
    const y = box.y + Math.min(box.height * 0.55, box.height - 8);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Still on the back — scroll must not fire the flip tap.
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(visibleText(page, 'Long-description')).toHaveCount(0);

    const scroll = page.locator('[data-testid="card-back-scroll"]:visible').first();
    const scrollTop = await scroll.evaluate((el) => {
      const nodes = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[];
      for (const node of nodes) {
        if (node.scrollHeight > node.clientHeight + 1) {
          return node.scrollTop;
        }
      }
      return (el as HTMLElement).scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
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

