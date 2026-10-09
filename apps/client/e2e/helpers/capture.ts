import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';
import type { ViewportId } from './viewports';

const HERE = __dirname;
const SCREENSHOT_ROOT = path.join(HERE, '..', 'screenshots');
const BASELINE_ROOT = path.join(HERE, '..', 'baselines');
const DIFF_ROOT = path.join(SCREENSHOT_ROOT, 'diffs');

/** Strict baselines only when Critiquito has approved and CI sets this. */
export function strictBaselinesEnabled(): boolean {
  return process.env.E2E_STRICT_BASELINES === '1';
}

function viewportIdFromProject(testInfo: TestInfo): ViewportId {
  const name = testInfo.project.name;
  if (name === '390x844' || name === '320x568' || name === '1280x800') {
    return name;
  }
  throw new Error(`Unknown Playwright project viewport: ${name}`);
}

/**
 * Full-page capture into e2e/screenshots/<viewport>/<name>.png.
 * Optionally compares to e2e/baselines/<viewport>/<name>.png (report-only by default).
 */
export async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<string> {
  const viewport = viewportIdFromProject(testInfo);
  const dir = path.join(SCREENSHOT_ROOT, viewport);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${name}.png`);

  await page.screenshot({
    path: outPath,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });

  await testInfo.attach(`${viewport}/${name}`, {
    path: outPath,
    contentType: 'image/png',
  });

  const baselinePath = path.join(BASELINE_ROOT, viewport, `${name}.png`);
  if (fs.existsSync(baselinePath)) {
    await compareToBaseline(page, testInfo, name, viewport, outPath, baselinePath);
  }

  return outPath;
}

async function compareToBaseline(
  page: Page,
  testInfo: TestInfo,
  name: string,
  viewport: ViewportId,
  actualPath: string,
  baselinePath: string,
): Promise<void> {
  const soft = !strictBaselinesEnabled();
  try {
    // Snapshot dir is e2e/baselines/<project> via playwright.config snapshotPathTemplate.
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fs.mkdirSync(DIFF_ROOT, { recursive: true });
    const notePath = path.join(DIFF_ROOT, `${viewport}__${name}.txt`);
    fs.writeFileSync(
      notePath,
      [
        `Baseline diff for ${viewport}/${name}`,
        `actual: ${actualPath}`,
        `baseline: ${baselinePath}`,
        `strict: ${strictBaselinesEnabled()}`,
        message,
        '',
      ].join('\n'),
      'utf8',
    );
    await testInfo.attach(`diff-note-${viewport}-${name}`, {
      path: notePath,
      contentType: 'text/plain',
    });
    if (!soft) {
      throw err;
    }
    testInfo.annotations.push({
      type: 'baseline-diff-report-only',
      description: `${viewport}/${name}: ${message.slice(0, 200)}`,
    });
  }
}

function cardPoint(box: { x: number; y: number; width: number; height: number }) {
  // Stay in the upper card area; laterality submenu sits at the bottom of the group.
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.3 };
}

function isBackFullyOpaque(): boolean {
  const nodes = Array.from(document.querySelectorAll('[data-testid="card-back-copy"]'));
  return nodes.some((el) => {
    let p: HTMLElement | null = el as HTMLElement;
    while (p) {
      if (getComputedStyle(p).opacity === '0') return false;
      p = p.parentElement;
    }
    return true;
  });
}

/** Flip the front card with a real mouse click (RNGH Tap on web). */
export async function flipCard(page: Page): Promise<void> {
  const stack = page.getByTestId('card-laterality-group');
  const box = await stack.boundingBox();
  if (!box) throw new Error('card-laterality-group has no bounding box');
  const wasFlipped = await page.evaluate(isBackFullyOpaque);
  const { x, y } = cardPoint(box);
  await page.mouse.click(x, y);
  await page.waitForFunction(
    (expectFlipped: boolean) => {
      const nodes = Array.from(document.querySelectorAll('[data-testid="card-back-copy"]'));
      const flipped = nodes.some((el) => {
        let p: HTMLElement | null = el as HTMLElement;
        while (p) {
          if (getComputedStyle(p).opacity === '0') return false;
          p = p.parentElement;
        }
        return true;
      });
      return flipped === expectFlipped;
    },
    !wasFlipped,
    { timeout: 8_000 },
  );
  await page.waitForTimeout(200);
}

/** Advance the deck with a left swipe across the card stack (not the laterality bar). */
export async function swipeForward(page: Page): Promise<void> {
  const stack = page.getByTestId('card-laterality-group');
  const box = await stack.boundingBox();
  if (!box) throw new Error('card-laterality-group has no bounding box');
  const y = box.y + box.height * 0.3;
  const fromX = box.x + box.width * 0.8;
  const toX = box.x + box.width * 0.15;
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}
