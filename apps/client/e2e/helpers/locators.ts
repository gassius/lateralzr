import type { Locator, Page } from '@playwright/test';

/** Deck chrome root (cards + laterality). */
export function deckRoot(page: Page): Locator {
  return page.getByTestId('card-laterality-group');
}

/**
 * RN Web keeps front + back faces (and a behind card) mounted with opacity.
 * Prefer a currently visible node to avoid strict-mode / hidden collisions.
 */
export function visibleText(page: Page, text: string | RegExp): Locator {
  const base =
    typeof text === 'string'
      ? page.getByText(text, { exact: true })
      : page.getByText(text);
  return base.locator('visible=true').first();
}

export function cardBackCopy(page: Page): Locator {
  return page.locator('[data-testid="card-back-copy"]:visible').first();
}

export function cardBackMedia(page: Page): Locator {
  return page.locator('[data-testid="card-back-media"]:visible').first();
}

export function cardBackTitle(page: Page): Locator {
  return page.locator('[data-testid="card-back-title"]:visible').first();
}

/**
 * Interactive front-of-stack title only (`exposeFrontTitleTestId` on the front card).
 * Prefer this over getByText for long labels — layout may insert `\\n` / `-\n`.
 */
export function cardFrontTitle(page: Page): Locator {
  return page.locator('[data-testid="card-front-title"]:visible').first();
}

/**
 * Interactive front-of-stack pattern layer only (same expose flag as the title).
 */
export function cardFrontPattern(page: Page): Locator {
  return page.locator('[data-testid="card-front-pattern"]').first();
}
