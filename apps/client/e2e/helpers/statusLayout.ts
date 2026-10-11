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

async function requireBox(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).toBeTruthy();
  return box as Box;
}

/**
 * B1: deck-status-line must be a real in-flow slot on the laterality label row —
 * not painted over the label lockup or the rail.
 * Fails on absolute full-width overlay; passes when status sits beside (or stacked
 * above) the label. Also pins a real minimum width so 200% text cannot collapse
 * the slot to single-character columns.
 */
export async function expectStatusLineClearOfLaterality(page: Page): Promise<void> {
  const status = page.getByTestId('deck-status-line');
  await expect(status).toBeVisible();
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
}
