import { expect, test } from '@playwright/test';
import { capture, flipCard } from '../helpers/capture';
import {
  cardBackCopy,
  cardBackEmboss,
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
    await expect(cardBackCopy(page).getByTestId('card-back-credit')).toHaveCount(0);
    await expect(cardBackTitle(page)).toHaveCount(0);
    await expect(page.getByTestId('card-back-wikipedia')).toBeVisible();
    await expect(page.getByLabel('About Mushroom')).toBeVisible();
    const emboss = cardBackEmboss(page);
    await expect(emboss).toBeAttached();
    await expect(emboss).toHaveAttribute('aria-hidden', 'true');
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media', locale: 'en' });
  });

  // Art-director: link spacing / body at large text — one viewport is enough.
  test('no media at 200% e2e text scale', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '390x844', 'one viewport covers the 200% back capture');
    await openApp(page, 'canonicalConcept=mushroom&e2eTextScale=2');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();
    await expect(page.getByTestId('card-back-media')).toHaveCount(0);
    await expect(page.getByTestId('card-back-wikipedia')).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'no-media-200', locale: 'en' });
  });

  test('no description fallback copy', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=no-description');
    await flipCard(page);
    await expect(
      page.getByText("There isn't a description for this concept yet."),
    ).toBeVisible();
    await expect(page.getByTestId('card-back-wikipedia')).toHaveCount(0);
    const emboss = cardBackEmboss(page);
    await expect(emboss).toBeAttached();
    await expect(emboss).toHaveAttribute('aria-hidden', 'true');
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
    await expect(page.getByTestId('card-back-emboss')).toHaveCount(0);
    await expect(cardBackMedia(page)).toHaveAttribute('data-media-fit', 'cover');
    await expect(page.locator('[data-testid="card-back-media"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-testid="card-back-media-decoder"]:visible')).toHaveCount(0);
    await capture(page, testInfo, { screen: 'card-back', state: 'with-photo', locale: 'en' });
  });

  for (const reference of ['enabled', 'absent'] as const) {
    test(`media credit remains with Wikipedia ${reference}`, async ({ page }) => {
      await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true', {
        mock: { omitWikipedia: reference === 'absent' },
      });
      await flipCard(page);
      const copy = cardBackCopy(page);
      await expect(copy.getByTestId('card-back-credit')).toHaveText(
        'Image: Lateralzr fixture photographer, Wikimedia Commons · CC BY-SA 4.0',
      );
      await expect(copy.getByTestId('card-back-credit')).toBeVisible();
      expect(await copy.getByTestId('card-back-credit').evaluate((el) =>
        el.parentElement?.previousElementSibling?.getAttribute('data-testid'),
      )).toBe(reference === 'enabled' ? 'card-back-wikipedia' : 'card-back-description');
      await expect(copy.getByTestId('card-back-wikipedia')).toHaveCount(reference === 'enabled' ? 1 : 0);
      await copy.getByTestId('card-back-credit').click();
      await expect(copy).toBeVisible();
    });
  }

  test('media credit prefix follows the active locale', async ({ page }) => {
    await openApp(page, 'localizedConcept=Psicodélicos&onlyWithMedia=true&locale=es');
    await flipCard(page);
    await expect(cardBackCopy(page).getByTestId('card-back-credit')).toHaveText(
      'Imagen: Lateralzr fixture photographer, Wikimedia Commons · CC BY-SA 4.0',
    );
  });

  test('license-only API media credits use the image source', async ({ page }) => {
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true', {
      mock: { licenseOnlyMedia: true },
    });
    await flipCard(page);
    await expect(cardBackCopy(page).getByTestId('card-back-credit')).toHaveText(
      'Image: Wikimedia Commons · CC BY-SA 4.0',
    );
  });

  test('media without credit metadata has no credit row', async ({ page }) => {
    await openApp(page, 'canonicalConcept=diagram&onlyWithMedia=true');
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await expect(cardBackCopy(page).getByTestId('card-back-credit')).toHaveCount(0);
  });

  // Art-director: scroll + min-28% band under large text — one viewport is enough.
  test('with photo at 200% e2e text scale', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '390x844', 'one viewport covers the 200% media-back capture');
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true&e2eTextScale=2');
    await expect(visibleText(page, 'Psychedelics')).toBeVisible();
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await expect(page.locator('[data-testid="card-back-description"]:visible').first()).toBeVisible();
    const credit = cardBackCopy(page).getByTestId('card-back-credit');
    const fade = page.locator('[data-testid="card-back-media-fade"]:visible').first();
    const inset = page.locator('[data-testid="card-back-reading-inset"]:visible').first();
    const fadeIsOutsideReadingScroll = () => fade.evaluate((el) => {
      const box = el.getBoundingClientRect();
      // Hit testing the fade area detects the reading scroller covering the
      // image transition, without checking screenshot pixels or exact styles.
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit?.closest('[data-testid="card-back-scroll"]') == null;
    });
    await expect(fade).toBeInViewport({ ratio: 1 });
    expect(await fadeIsOutsideReadingScroll()).toBe(true);
    await dragCardBackCopyUp(page, 160);
    expect(await readBackScrollTop(page)).toBeGreaterThan(0);
    await credit.evaluate((el) => {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    await expect(credit).toBeVisible();
    await expect(inset).toBeVisible();
    await expect(fade).toBeVisible();
    expect(await fadeIsOutsideReadingScroll()).toBe(true);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-photo-200-scrolled', locale: 'en' });
    await cardBackScroll(page).evaluate((el) => { el.scrollTop = 0; });
    await capture(page, testInfo, { screen: 'card-back', state: 'with-photo-200', locale: 'en' });
  });

  test('with diagram (direct deep link)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=diagram&onlyWithMedia=true');
    // Front title may wrap with \\n; match the unwrapped aria-label.
    await expect(cardFrontTitle(page)).toHaveAttribute('aria-label', /schematic lattice/i);
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await expect(cardBackMedia(page)).toHaveAttribute('data-media-fit', 'contain');
    await expect(page.locator('[data-testid="card-back-media"]:visible')).toHaveCount(1);
    await capture(page, testInfo, { screen: 'card-back', state: 'with-diagram', locale: 'en' });
  });

  test('broken media URL falls back to the no-media back', async ({ page }) => {
    await openApp(page, 'localizedConcept=Psychedelics&onlyWithMedia=true', {
      mock: { brokenMedia: true },
    });
    await flipCard(page);
    await expect(page.locator('[data-testid="card-back-without-media"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="card-back-media"]:visible')).toHaveCount(0);
    await expect(cardBackCopy(page)).toBeVisible();
  });

  test('with transparent media', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=transparent&onlyWithMedia=true');
    await expect(cardFrontTitle(page)).toHaveAttribute('aria-label', /amber cutout/i);
    await flipCard(page);
    await expect(cardBackMedia(page)).toBeVisible();
    await capture(page, testInfo, { screen: 'card-back', state: 'with-transparent', locale: 'en' });
  });

  test('wikipedia link does not flip the card', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();

    // Stub navigation so Linking.openURL cannot leave the SPA or open a tab.
    await page.route('https://en.wikipedia.org/**', (route) => route.abort());
    await page.evaluate(() => {
      window.open = () => null;
    });

    const wiki = page.getByTestId('card-back-wikipedia');
    await expect(wiki).toBeVisible();
    await wiki.click();

    // Suppress window is 400 ms; confirm the back face stayed up (AC: link must not flip).
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const nodes = Array.from(document.querySelectorAll('[data-testid="card-back-copy"]'));
            return nodes.some((el) => {
              let p: HTMLElement | null = el as HTMLElement;
              while (p) {
                if (getComputedStyle(p).opacity === '0') return false;
                p = p.parentElement;
              }
              return true;
            });
          }),
        { timeout: 1_000 },
      )
      .toBe(true);
    await expect(cardBackCopy(page)).toBeVisible();
  });

  /**
   * Playwright projects already set contextOptions.reducedMotion = 'reduce'.
   * Assert the RM flip path: back visible; face computed transforms have no rotate/perspective.
   */
  test('reduced-motion flip has no rotate or perspective', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom');
    await flipCard(page);
    await expect(cardBackCopy(page)).toBeVisible();

    const hasForbiddenTransform = await page.evaluate(() => {
      const isVisible = (el: Element) => {
        let p: HTMLElement | null = el as HTMLElement;
        while (p) {
          if (getComputedStyle(p).opacity === '0') return false;
          p = p.parentElement;
        }
        return true;
      };
      const transformForbidden = (value: string) =>
        /rotate|perspective/i.test(value) && value !== 'none';

      // Active (visible) back + its front sibling faces only — not preload peers.
      const starts = [
        ...document.querySelectorAll('[data-testid="card-back-copy"]'),
        ...document.querySelectorAll('[data-testid="card-front-title"]'),
      ].filter(isVisible);

      for (const start of starts) {
        let p: HTMLElement | null = start as HTMLElement;
        while (p) {
          const inline = p.getAttribute('style') ?? '';
          const computed = getComputedStyle(p).transform;
          if (transformForbidden(inline) || transformForbidden(computed)) return true;
          if (p.getAttribute('data-testid') === 'card-laterality-group') break;
          p = p.parentElement;
        }
      }
      return false;
    });
    expect(hasForbiddenTransform).toBe(false);
  });
});


// Functional layout and scroll checks only, at the single phone viewport.
for (const concept of ['mushroom', 'no-description']) {
  for (const scale of [1, 2]) {
    test(`${concept} back uses lower reading region at ${scale * 100}% text`, async ({ page }) => {
      await openApp(page, `canonicalConcept=${concept}&e2eTextScale=${scale}`);
      await flipCard(page);
      const scroll = cardBackScroll(page);
      await expect(cardBackCopy(page)).toBeInViewport();
      // The rendered content column owns the lower anchor; no pixel assertions.
      await expect(scroll.locator(':scope > div').first()).toHaveCSS('justify-content', 'flex-end');
      const insets = await cardBackCopy(page).evaluate((el) => {
        const face = el.closest('[data-testid="card-back-without-media"]')!;
        const copyBox = el.getBoundingClientRect();
        const faceBox = face.getBoundingClientRect();
        const style = getComputedStyle(face);
        return {
          bottom: faceBox.bottom - copyBox.bottom,
          left: copyBox.left - faceBox.left,
          right: faceBox.right - copyBox.right,
          padding: Number.parseFloat(style.paddingBottom),
        };
      });
      // Relative to the actual face padding, so a missing content minHeight
      // cannot pass just because justifyContent still says flex-end.
      expect(insets.bottom).toBeCloseTo(insets.padding, 0);
      expect(insets.left).toBeCloseTo(insets.padding, 0);
      expect(insets.right).toBeCloseTo(insets.padding, 0);
      expect(await scroll.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await dragCardBackCopyUp(page, 160);
      expect(await readBackScrollTop(page)).toBe(0);
      await expect(cardBackCopy(page)).toBeVisible();
      if (concept === 'mushroom') {
        await expect(page.getByTestId('card-back-wikipedia')).toBeInViewport();
      } else {
        await expect(page.getByTestId('card-back-wikipedia')).toHaveCount(0);
      }
    });
  }
}

for (const scale of [1, 2]) {
  test(`long no-media copy is reachable by scrolling at ${scale * 100}% text`, async ({ page }) => {
    await openApp(page, `canonicalConcept=long-description&e2eTextScale=${scale}`);
    await flipCard(page);
    const scroll = cardBackScroll(page);
    const description = page.locator('[data-testid="card-back-description"]:visible').first();
    expect((await description.textContent())?.startsWith('A long reading passage')).toBe(true);
    expect(await readBackScrollTop(page)).toBe(0);
    // A Range checks whether the first/last character is reachable inside the
    // scroll viewport, including 200% text, without comparing fixed positions.
    const paragraphEdgeIsReachable = (el: Element, edge: 'first' | 'last') => {
      const text = edge === 'first' ? el.firstChild! : el.lastChild!;
      const length = text.textContent?.length ?? 0;
      const start = edge === 'first' ? 0 : Math.max(0, length - 1);
      const range = document.createRange();
      range.setStart(text, start);
      range.setEnd(text, Math.min(length, start + 1));
      const ink = range.getBoundingClientRect();
      const viewport = el.closest('[data-testid="card-back-scroll"]')!.getBoundingClientRect();
      return ink.top >= viewport.top && ink.bottom <= viewport.bottom;
    };
    expect(await description.evaluate(paragraphEdgeIsReachable, 'first')).toBe(true);
    await dragCardBackCopyUp(page, 160);
    expect(await readBackScrollTop(page)).toBeGreaterThan(0);
    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    expect(await description.evaluate(paragraphEdgeIsReachable, 'last')).toBe(true);
    await expect(cardBackCopy(page)).toBeVisible();
  });
}
