import { expect, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * B1: deck-status-line must be a real in-flow slot on the laterality label row —
 * not painted over the label lockup or the rail.
 * Fails on absolute full-width overlay; passes when status sits beside the label.
 * Polls briefly — label-row flex can settle a frame after the loading face mounts.
 */
export async function expectStatusLineClearOfLaterality(page: Page): Promise<void> {
  const status = page.getByTestId('deck-status-line');
  await expect(status).toBeVisible();
  await expect(page.getByTestId('laterality-label')).toBeVisible();
  await expect(page.getByTestId('laterality-rail')).toBeVisible();

  await expect
    .poll(
      async () => {
        const statusBox = await status.boundingBox();
        if (!statusBox) return 'no-status';
        for (const id of ['laterality-label', 'laterality-rail'] as const) {
          const controlBox = await page.getByTestId(id).boundingBox();
          if (!controlBox) return `no-${id}`;
          if (boxesIntersect(statusBox, controlBox)) return `intersects-${id}`;
        }
        return 'clear';
      },
      { timeout: 3_000, intervals: [50, 100, 200] },
    )
    .toBe('clear');
}
