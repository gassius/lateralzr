import { expect, test } from '@playwright/test';
import { capture, swipeBack, swipeForward } from '../helpers/capture';
import { cardFrontTitle, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

async function clickLateralityRail(page: import('@playwright/test').Page, fraction: number) {
  const rail = page.getByTestId('laterality-rail');
  const box = await rail.boundingBox();
  expect(box, 'laterality-rail bounding box').toBeTruthy();
  if (!box) throw new Error('laterality-rail has no bounding box');
  await rail.click({
    position: { x: Math.floor(box.width * fraction), y: Math.floor(box.height / 2) },
  });
}

/** Advance reshuffle timers (status 300 + min cue 900 + RM deal/reverse 150). */
async function completeReshuffleCue(page: import('@playwright/test').Page) {
  await page.clock.fastForward(300);
  await page.clock.fastForward(600);
  await page.clock.fastForward(150);
}

/**
 * Clock.fastForward after settle breaks RNGH mouse swipes (see preparePage).
 * Arrow keys go through cardActions, not the pan recognizer.
 */
async function stepHistory(
  page: import('@playwright/test').Page,
  direction: 'back' | 'forward',
  expectLabel: string,
) {
  const surface = page.getByTestId('card-a11y-surface');
  await expect(surface).toBeFocused();
  await page.keyboard.press(direction === 'back' ? 'ArrowLeft' : 'ArrowRight');
  // RM commit is a 150ms withTiming; advance the installed clock so it can settle.
  await page.clock.fastForward(200);
  await expect(visibleText(page, expectLabel)).toBeVisible({ timeout: 8_000 });
}

test.describe('laterality bar', () => {
  for (const grade of [1, 3, 5] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`grade ${grade} (${locale})`, async ({ page }, testInfo) => {
        await openApp(page, `canonicalConcept=mushroom&laterality=${grade}&locale=${locale}`);
        await expect(page.getByTestId('laterality-control')).toBeVisible();
        await expect(page.getByTestId('laterality-rail')).toBeVisible();
        await expect(page.getByTestId('laterality-label')).toBeVisible();
        await expect(page.getByTestId('laterality-wordmark')).toHaveCount(0);
        await capture(page, testInfo, {
          screen: 'laterality-bar',
          state: `grade-${grade}`,
          locale,
        });
      });
    }
  }

  test('tapping the 5th rail position selects Random entry and requests laterality 5', async ({
    page,
  }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=1&locale=en');
    await expect(page.getByTestId('laterality-label')).toContainText('Laterality · Same domain');

    const relationshipsWithFive = page.waitForRequest((req) => {
      if (!req.url().includes('/api/concepts/relationships') || req.method() !== 'POST') {
        return false;
      }
      try {
        const body = req.postDataJSON() as { laterality?: number };
        return body?.laterality === 5;
      } catch {
        return false;
      }
    });

    await clickLateralityRail(page, 0.92);

    await expect(page.getByTestId('laterality-label')).toContainText(
      'Laterality · Random entry',
    );
    await relationshipsWithFive;
  });

  test('A→B→C then laterality 5 deals D1; right-swipe returns C, B, A', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=3&locale=en');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await swipeForward(page, 'Mycelium');
    await swipeForward(page, 'Spore');

    await clickLateralityRail(page, 0.92);
    await completeReshuffleCue(page);

    await expect(visibleText(page, 'Entropy')).toBeVisible({ timeout: 8_000 });
    const surface = page.getByTestId('card-a11y-surface');
    await expect(surface).toHaveAttribute('data-laterality-grade', '5');
    // Deal moves a11y focus; the test must not call .focus() itself (review B3).
    await expect(surface).toBeFocused();
    await expect(page.getByTestId('laterality-label')).toContainText('Random entry');

    await stepHistory(page, 'back', 'Spore');
    await stepHistory(page, 'back', 'Mycelium');
    await stepHistory(page, 'back', 'Mushroom');
    await expect(cardFrontTitle(page)).toHaveText('Mushroom');
  });

  test('seen-ahead future is discarded; left from C goes to D1', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=3&locale=en');
    await swipeForward(page, 'Mycelium');
    await swipeForward(page, 'Spore');
    await swipeBack(page, 'Mycelium');

    await clickLateralityRail(page, 0.92);
    await completeReshuffleCue(page);

    await expect(visibleText(page, 'Entropy')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('card-a11y-surface')).toBeFocused();
    await stepHistory(page, 'back', 'Mycelium');
    await expect(visibleText(page, 'Spore')).toHaveCount(0);
    await stepHistory(page, 'forward', 'Entropy');
  });

  test('no-match keeps the new grade and shows Adjust', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&laterality=3&locale=en', {
      mock: { lateralityNoMatch: 4 },
    });
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await clickLateralityRail(page, 0.72);
    await completeReshuffleCue(page);

    await expect(page.getByTestId('laterality-label')).toContainText('Provocation');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(page.getByTestId('deck-status-line')).toContainText(
      /No next idea at this setting/i,
    );
    const adjust = page.getByTestId('deck-status-adjust');
    await expect(adjust).toBeVisible();
    await adjust.click();
    await expect(page.getByTestId('laterality-sheet')).toBeVisible({ timeout: 4_000 });
  });

  for (const locale of ['en', 'es'] as const) {
    const labelParts =
      locale === 'es'
        ? { prefix: /Lateralidad/, grade: /Puente abstracto/ }
        : { prefix: /Laterality/, grade: /Abstract bridge/ };

    test(`label wraps without truncation at 200% text (${locale})`, async ({
      page,
    }, testInfo) => {
      await openApp(
        page,
        `canonicalConcept=mushroom&laterality=3&locale=${locale}&e2eTextScale=2`,
      );
      const label = page.getByTestId('laterality-label');
      await expect(label).toBeVisible();
      const text = await label.innerText();
      expect(text).toMatch(labelParts.prefix);
      expect(text).toMatch(labelParts.grade);
      expect(text).not.toMatch(/\.\.\.|…/);
      const truncated = await label.evaluate((el) => {
        const style = getComputedStyle(el);
        return (
          style.textOverflow === 'ellipsis' ||
          el.scrollWidth > el.clientWidth + 1
        );
      });
      expect(truncated).toBe(false);

      await expect(page.getByTestId('laterality-label-chevron')).toBeVisible();

      await capture(page, testInfo, {
        screen: 'laterality-bar',
        state: 'wrap-200',
        locale,
      });
    });
  }
});
