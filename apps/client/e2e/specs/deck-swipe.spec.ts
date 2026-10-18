import { expect, test } from '@playwright/test';
import {
  flipCard,
  holdHorizontalDrag,
  swipeBack,
  swipeForward,
  swipeVertical,
} from '../helpers/capture';
import { cardBackCopy, cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

test.describe('deck swipe (Lz-56)', () => {
  test('left commit advances; right at start of history stays; right after next returns', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await swipeForward(page, 'Mycelium');
    await expect(visibleText(page, 'Mycelium')).toBeVisible();

    await swipeBack(page, 'Mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await swipeBack(page);
    await expect(cardFrontTitle(page)).toHaveText('Mushroom');
  });

  test('front and back faces accept next via swipe and keyboard', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await swipeForward(page, 'Mycelium');
    await expect(visibleText(page, 'Mycelium')).toBeVisible();

    const surface = page.getByTestId('card-a11y-surface');
    await page.keyboard.press('Tab');
    await surface.focus();
    await page.keyboard.press('ArrowRight');
    await expect(visibleText(page, 'Spore')).toBeVisible({ timeout: 10_000 });
  });

  test('vertical swipe and Complexity actions change the cue', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await swipeVertical(page, 'up');
    await expect(page.getByTestId('complexity-cue')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('accessible-nav-row')).toBeVisible();
    await page.getByTestId('a11y-nav-complexity-down').click();
    await expect(page.getByTestId('complexity-cue')).toBeVisible();
  });

  test('back face vertical swipe commits Complexity', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await swipeVertical(page, 'up');
    await expect(page.getByTestId('complexity-cue')).toBeVisible({ timeout: 10_000 });
  });

  test('flip toggles front → back → front', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await flipCard(page);
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardBackCopy(page)).toHaveCount(0);
  });

  test('underlay is hidden from AT; chrome ignores presses mid-drag and works after settle', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    const underlay = page.getByTestId('deck-underlay');
    await expect(underlay).toHaveCount(1);
    await expect(underlay).toHaveAttribute('aria-hidden', 'true');

    await holdHorizontalDrag(page, 'left', 0.22);
    await expect(page.getByTestId('card-laterality-group')).toHaveAttribute(
      'data-deck-moving',
      'true',
    );
    await page.getByTestId('app-menu-trigger').click({ force: true });
    await expect(page.getByTestId('app-menu')).toHaveCount(0);
    await page.mouse.up();

    await expect
      .poll(async () => page.getByTestId('card-laterality-group').getAttribute('data-deck-moving'), {
        timeout: 8_000,
      })
      .toBe('false');

    await page.getByTestId('app-menu-trigger').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
  });

  test('Wikipedia and credits do not flip or swipe the card', async ({ page }) => {
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();

    await page.getByTestId('card-back-wikipedia').click();
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(visibleText(page, 'Psychedelics')).toHaveCount(0);

    await cardBackCopy(page).getByTestId('card-back-credit').click();
    await expect(cardBackCopy(page)).toBeVisible();
  });
});
