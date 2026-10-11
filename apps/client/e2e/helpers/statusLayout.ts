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
 * B1: deck-status-line must be a real in-flow slot on the laterality label row —
 * not painted over the label lockup or the rail.
 * Fails on absolute full-width overlay; passes when status sits beside (or stacked
 * above) the label. Also pins a real minimum width so 200% text cannot collapse
 * the slot to single-character columns.
 *
 * Width + intersection run inside `toPass` so 200% wrap reflow cannot flake mid-layout.
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

    for (const id of ['laterality-label', 'laterality-rail'] as const) {
      const control = page.getByTestId(id);
      await expect(control).toBeVisible();
      const controlBox = await requireBox(control, id);
      expect(
        boxesIntersect(statusBox, controlBox),
        `deck-status-line must not intersect ${id}`,
      ).toBe(false);
    }
  }).toPass({ timeout: 2_000 });
}
