import type { Page } from '@playwright/test';

/** Visible card-back ScrollView (front/back both mount; opacity hides one). */
export function cardBackScroll(page: Page) {
  return page.locator('[data-testid="card-back-scroll"]:visible').first();
}

export async function readBackScrollTop(page: Page): Promise<number> {
  return cardBackScroll(page).evaluate((el) => (el as HTMLElement).scrollTop);
}

/**
 * Vertical touch drag starting on the visible portion of `card-back-copy`.
 *
 * Chromium does not apply mouse-drag to `overflow:auto`, so Playwright mouse
 * paths leave scrollTop at 0. CDP touch is a real pointer drag that:
 * - exceeds Tap.maxDeltaY(10) (and maxDistance on a long drag) so the card stays flipped
 * - scrolls the RNGH/RN-web ScrollView (scrollTop > 0)
 *
 * The copy's full bounding box can extend below the ScrollView clip on long
 * descriptions — clamp the start point into the visible scroll viewport.
 */
export async function dragCardBackCopyUp(page: Page, distance = 160): Promise<void> {
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

  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  const steps = 16;
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
