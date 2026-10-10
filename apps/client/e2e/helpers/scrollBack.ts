import type { Page } from '@playwright/test';

/** Visible card-back ScrollView (front/back both mount; opacity hides one). */
export function cardBackScroll(page: Page) {
  return page.locator('[data-testid="card-back-scroll"]:visible').first();
}

export async function readBackScrollTop(page: Page): Promise<number> {
  return cardBackScroll(page).evaluate((el) => (el as HTMLElement).scrollTop);
}

type DragPoint = { x: number; y: number };

/** Start point on the visible portion of card-back-copy (clamped into ScrollView clip). */
async function cardBackCopyDragOrigin(page: Page): Promise<DragPoint> {
  const copy = page.locator('[data-testid="card-back-copy"]:visible').first();
  const scroll = cardBackScroll(page);
  const copyBox = await copy.boundingBox();
  const scrollBox = await scroll.boundingBox();
  if (!copyBox) throw new Error('card-back-copy has no bounding box');
  if (!scrollBox) throw new Error('card-back-scroll has no bounding box');

  const x = copyBox.x + copyBox.width / 2;
  const unclampedY = copyBox.y + Math.min(copyBox.height * 0.35, 48);
  const y = Math.max(
    scrollBox.y + 12,
    Math.min(unclampedY, scrollBox.y + scrollBox.height - 24),
  );
  return { x, y };
}

/**
 * Vertical CDP touch drag starting on the visible portion of `card-back-copy`.
 *
 * Chromium mouse-drag does not move overflow:auto scrollTop; touch does.
 * The copy's full bounding box can extend below the ScrollView clip on long
 * descriptions — start Y is clamped into the visible scroll viewport.
 *
 * Use ~12px to exercise Tap.maxDeltaY(10) while staying under maxDistance(14).
 * Use ~160px to scroll (scrollTop > 0); that path also exceeds maxDistance.
 */
export async function dragCardBackCopyUp(page: Page, distance: number): Promise<void> {
  const { x, y } = await cardBackCopyDragOrigin(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  const steps = distance <= 14 ? 4 : 16;
  for (let i = 1; i <= steps; i++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - (distance * i) / steps, id: 1 }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(200);
}
