import { expect, type Locator, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function boxKey(box: Box): string {
  return `${Math.round(box.x)}|${Math.round(box.y)}|${Math.round(box.width)}|${Math.round(box.height)}`;
}

async function requireBox(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).toBeTruthy();
  return box as Box;
}

/**
 * Wait until loading-card + status + rail report two identical bounding boxes.
 * Initial-load captures at 390/430 otherwise race mid-reflow (taller card, short track).
 */
export async function waitForStableLoadingChrome(page: Page): Promise<void> {
  const loading = page.getByTestId('loading-card');
  const status = page.getByTestId('deck-status-line');
  const rail = page.getByTestId('laterality-rail');
  await expect(loading).toBeVisible();
  await expect(status).toBeVisible();
  await expect(rail).toBeVisible();

  await expect(async () => {
    const first = await Promise.all([
      requireBox(loading, 'loading-card'),
      requireBox(status, 'deck-status-line'),
      requireBox(rail, 'laterality-rail'),
    ]);
    await page.waitForTimeout(50);
    const second = await Promise.all([
      requireBox(loading, 'loading-card'),
      requireBox(status, 'deck-status-line'),
      requireBox(rail, 'laterality-rail'),
    ]);
    expect(
      first.map(boxKey).join(';'),
      'loading chrome bounding boxes must match across two reads',
    ).toBe(second.map(boxKey).join(';'));
    // Settled rail should match the loading card column (not ~80% mid-reflow).
    expect(
      second[2].width,
      'laterality-rail settled width vs loading-card',
    ).toBeGreaterThanOrEqual(second[0].width * 0.92);
  }).toPass({ timeout: 2_000 });
}

/**
 * B1 / AD #119: deck-status-line lives in the reserved status band above the
 * Laterality label — never beside it, never painted over the label or rail.
 * Pins a real minimum width so 200% text cannot collapse to single-character columns.
 *
 * Width + intersection + stacking run inside `toPass` so reflow cannot flake.
 */
export async function expectStatusLineClearOfLaterality(page: Page): Promise<void> {
  const status = page.getByTestId('deck-status-line');
  await expect(status).toBeVisible();

  await expect(async () => {
    const statusBox = await requireBox(status, 'deck-status-line');

    // STATUS_SLOT_MIN_WIDTH (120) — keep in sync with lateralityChrome.ts.
    expect(
      statusBox.width,
      'deck-status-line must keep a word-wrapping minimum width (not a 1-glyph column)',
    ).toBeGreaterThanOrEqual(120);

    const label = page.getByTestId('laterality-label');
    await expect(label).toBeVisible();
    const labelBox = await requireBox(label, 'laterality-label');
    expect(
      boxesIntersect(statusBox, labelBox),
      'deck-status-line must not intersect laterality-label',
    ).toBe(false);
    // Full-width band above the label (not a side-by-side squeeze).
    expect(
      statusBox.y + statusBox.height,
      'deck-status-line must sit above laterality-label',
    ).toBeLessThanOrEqual(labelBox.y + 1);

    const rail = page.getByTestId('laterality-rail');
    await expect(rail).toBeVisible();
    const railBox = await requireBox(rail, 'laterality-rail');
    expect(
      boxesIntersect(statusBox, railBox),
      'deck-status-line must not intersect laterality-rail',
    ).toBe(false);

    // Status should span the control column (full-width band), not a narrow gutter.
    expect(
      statusBox.width,
      'deck-status-line should use the full-width status band',
    ).toBeGreaterThanOrEqual(railBox.width * 0.85);
  }).toPass({ timeout: 2_000 });
}

/**
 * Front card face box via the pattern layer (stable outer frame for Lz-38 AD).
 */
export async function cardFaceBoundingBox(page: Page): Promise<Box> {
  const pattern = page.getByTestId('card-front-pattern');
  await expect(pattern).toBeVisible();
  return requireBox(pattern, 'card-front-pattern');
}

/**
 * AD #119: card frame must be identical with and without a status line.
 * Compares rounded boxes so sub-pixel layout noise cannot flake.
 */
export async function expectCardBoxesEqual(
  withoutStatus: Box,
  withStatus: Box,
): Promise<void> {
  expect(boxKey(withStatus), 'card box with status must match card box without status').toBe(
    boxKey(withoutStatus),
  );
}
