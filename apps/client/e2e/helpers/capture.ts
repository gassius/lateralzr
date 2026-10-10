import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { type Page, type TestInfo } from '@playwright/test';
import type { ViewportId } from './viewports';
import { visibleText } from './locators';

const HERE = __dirname;
const SCREENSHOT_ROOT = path.join(HERE, '..', 'screenshots');
const BASELINE_ROOT = path.join(HERE, '..', 'baselines');
const DIFF_ROOT = path.join(SCREENSHOT_ROOT, 'diffs');

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

/** `<screen>_<state>_<viewport>_<locale>.png` */
export function screenshotFileName(
  screen: string,
  state: string,
  viewport: string,
  locale: string,
): string {
  return `${screen}_${state}_${viewport}_${locale}.png`;
}

export type CaptureArgs = {
  screen: string;
  state: string;
  locale?: string;
};

/**
 * Full-page capture into e2e/screenshots/<screen>_<state>_<viewport>_<locale>.png.
 * Compares to e2e/baselines/ when present (report-only unless E2E_STRICT_BASELINES=1).
 */
export async function capture(
  page: Page,
  testInfo: TestInfo,
  args: CaptureArgs,
): Promise<string> {
  const viewport = viewportIdFromProject(testInfo);
  const locale = args.locale ?? 'en';
  const fileName = screenshotFileName(args.screen, args.state, viewport, locale);
  fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  const outPath = path.join(SCREENSHOT_ROOT, fileName);

  await page.screenshot({
    path: outPath,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });

  await testInfo.attach(fileName, {
    path: outPath,
    contentType: 'image/png',
  });

  const baselinePath = path.join(BASELINE_ROOT, fileName);
  if (fs.existsSync(baselinePath)) {
    await compareToBaseline(testInfo, fileName, outPath, baselinePath);
  }

  return outPath;
}

type DiffSummaryRow = {
  file: string;
  ratio: number;
  percent: number;
  threshold: number;
  status: 'pass' | 'over-threshold' | 'size-mismatch';
  mismatchedPixels: number;
  diffImage?: string;
  note?: string;
};

function writeDiffSummary(row: DiffSummaryRow): void {
  fs.mkdirSync(DIFF_ROOT, { recursive: true });
  const summaryPath = path.join(DIFF_ROOT, 'summary.json');
  let rows: DiffSummaryRow[] = [];
  if (fs.existsSync(summaryPath)) {
    try {
      rows = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as DiffSummaryRow[];
    } catch {
      rows = [];
    }
  }
  rows = rows.filter((r) => r.file !== row.file);
  rows.push(row);
  rows.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(summaryPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

async function compareToBaseline(
  testInfo: TestInfo,
  fileName: string,
  actualPath: string,
  baselinePath: string,
): Promise<void> {
  const soft = !strictBaselinesEnabled();
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const threshold = 0.01;

  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    const stem = fileName.replace(/\.png$/, '');
    const notePath = path.join(DIFF_ROOT, `${stem}.txt`);
    const actualCopy = path.join(DIFF_ROOT, `${stem}.actual.png`);
    const baselineCopy = path.join(DIFF_ROOT, `${stem}.baseline.png`);
    const message = `size mismatch actual=${actual.width}x${actual.height} baseline=${baseline.width}x${baseline.height}`;
    fs.mkdirSync(DIFF_ROOT, { recursive: true });
    fs.writeFileSync(notePath, `${message}\n`, 'utf8');
    fs.copyFileSync(actualPath, actualCopy);
    fs.copyFileSync(baselinePath, baselineCopy);
    writeDiffSummary({
      file: fileName,
      ratio: 1,
      percent: 100,
      threshold,
      status: 'size-mismatch',
      mismatchedPixels: -1,
      note: message,
    });
    await testInfo.attach(`diff-note-${fileName}`, { path: notePath, contentType: 'text/plain' });
    await testInfo.attach(`diff-actual-${fileName}`, { path: actualCopy, contentType: 'image/png' });
    testInfo.annotations.push({ type: 'baseline-diff-report-only', description: `${fileName}: ${message}` });
    if (!soft) throw new Error(message);
    return;
  }

  const diff = new PNG({ width: actual.width, height: actual.height });
  const mismatched = pixelmatch(actual.data, baseline.data, diff.data, actual.width, actual.height, {
    threshold: 0.1,
  });
  const ratio = mismatched / (actual.width * actual.height);
  const percent = ratio * 100;
  const over = ratio > threshold;
  const stem = fileName.replace(/\.png$/, '');
  const diffRel = over ? `${stem}.diff.png` : undefined;

  if (over) {
    fs.mkdirSync(DIFF_ROOT, { recursive: true });
    const diffPng = path.join(DIFF_ROOT, diffRel!);
    const notePath = path.join(DIFF_ROOT, `${stem}.txt`);
    fs.writeFileSync(diffPng, PNG.sync.write(diff));
    const message = `diff ratio ${ratio.toFixed(4)} > ${threshold} (${mismatched} px)`;
    fs.writeFileSync(
      notePath,
      [`Baseline diff for ${fileName}`, `actual: ${actualPath}`, `baseline: ${baselinePath}`, message, ''].join(
        '\n',
      ),
      'utf8',
    );
    await testInfo.attach(`diff-${fileName}`, { path: diffPng, contentType: 'image/png' });
    await testInfo.attach(`diff-note-${fileName}`, { path: notePath, contentType: 'text/plain' });
    testInfo.annotations.push({
      type: 'baseline-diff-report-only',
      description: `${fileName}: ${message}`,
    });
  }

  writeDiffSummary({
    file: fileName,
    ratio,
    percent,
    threshold,
    status: over ? 'over-threshold' : 'pass',
    mismatchedPixels: mismatched,
    ...(diffRel ? { diffImage: diffRel } : {}),
  });

  if (over && !soft) {
    throw new Error(`diff ratio ${ratio.toFixed(4)} > ${threshold}`);
  }
}

function cardPoint(box: { x: number; y: number; width: number; height: number }) {
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
}

/**
 * Advance the deck with a left swipe.
 * Pass `expectLabel` to wait for the next card's front label (preferred).
 */
export async function swipeForward(
  page: Page,
  expectLabel?: string | RegExp,
): Promise<void> {
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

  if (expectLabel != null) {
    await visibleText(page, expectLabel).waitFor({ state: 'visible', timeout: 8_000 });
  }
  // When no label is provided (e.g. end-of-deck loading), the caller waits on the resulting UI.
}
