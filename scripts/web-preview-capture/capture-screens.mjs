#!/usr/bin/env node
/**
 * Playwright 390×844 screenshots of Expo web export (cheap design preview).
 * Honesty: web preview is NOT native acceptance evidence.
 *
 * Fail closed: waits for seeded fixture roots; exits non-zero on error/guard
 * text or near-uniform stills.
 *
 * Phone-ish frame (botore #110/#111 delivery-speed):
 * - deviceScaleFactor 3 (~native px/pt)
 * - Worst-case insets: iPhone top 47 + Android nav bottom 48 → ~749 pt usable
 *
 * Env:
 *   WEB_PREVIEW_BASE_URL  (default http://127.0.0.1:4173)
 *   WEB_PREVIEW_SCREENS   comma-separated screen ids (default CardFront)
 *   WEB_PREVIEW_OUT_DIR   (default artifacts/web-preview-captures)
 *   WEB_PREVIEW_SETTLE_MS (default 2000)
 *   WEB_PREVIEW_HEAD_SHA  PR head SHA (falls back to GITHUB_SHA / local)
 */
import { inflateSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const FIXTURES = path.join(REPO, 'apps/client/e2e/fixtures');

const WIDTH = 390;
const HEIGHT = 844;
/** ~native Pixel density (design: native ≈ 2.77 px/pt). */
const DEVICE_SCALE_FACTOR = 3;
/**
 * Worst case of each edge on a 390×844@3x frame:
 * iPhone-ish status/safe top 47 + Android nav bottom 48 → usable ≈ 749 pt.
 */
const INSET_TOP_PT = 47;
const INSET_BOTTOM_PT = 48;
const INSET_HEX = '#000000';

const FAIL_CLOSED_GUARD_TEXTS = [
  'Something went wrong',
  'Unable to load',
  'No matching neighborhood',
  'Failed to fetch',
];

const SCREEN_READY = {
  CardFront: 'card-front-title',
  CardBack: 'card-back-copy',
  LateralityBar: 'laterality-control',
  AppMenu: 'app-menu',
};

/** Prefer front-of-stack card when underlay cards also expose the same testID. */
function readyLocator(page, screen) {
  const id = SCREEN_READY[screen];
  if (screen === 'CardBack') {
    return page.getByTestId('card-a11y-surface').getByTestId(id);
  }
  if (screen === 'CardFront') {
    return page.locator(`[data-testid="${id}"]:visible`).first();
  }
  return page.getByTestId(id).first();
}

function screensFromEnv() {
  const raw = process.env.WEB_PREVIEW_SCREENS || 'CardFront';
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

function headSha() {
  return process.env.WEB_PREVIEW_HEAD_SHA || process.env.GITHUB_SHA || 'local';
}

/**
 * Paint opaque phone chrome bars over the product safe-area bands (47/48).
 * Content already lives inside WebPhoneFrame SafeAreaInsets — do NOT also pad
 * `#root` (that would double-count usable height).
 */
async function applyPhoneInsets(page) {
  await page.evaluate(
    ({ top, bottom }) => {
      const STYLE_ID = 'lateralzr-web-preview-phone-insets';
      document.getElementById(STYLE_ID)?.remove();
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #lateralzr-web-preview-inset-top,
        #lateralzr-web-preview-inset-bottom {
          position: fixed !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
          background: #000 !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        #lateralzr-web-preview-inset-top {
          top: 0 !important;
          height: ${top}px !important;
          max-height: ${top}px !important;
        }
        #lateralzr-web-preview-inset-bottom {
          bottom: 0 !important;
          height: ${bottom}px !important;
          max-height: ${bottom}px !important;
        }
      `;
      document.head.appendChild(style);
      for (const [id, where] of [
        ['lateralzr-web-preview-inset-top', 'top'],
        ['lateralzr-web-preview-inset-bottom', 'bottom'],
      ]) {
        if (!document.getElementById(id)) {
          const bar = document.createElement('div');
          bar.id = id;
          bar.setAttribute('data-lateralzr-phone-inset', where);
          document.body.appendChild(bar);
        }
      }
    },
    { top: INSET_TOP_PT, bottom: INSET_BOTTOM_PT },
  );
}

async function installFixtureMocks(page) {
  const mushroom = fs.readFileSync(path.join(FIXTURES, 'relationships/mushroom-en.json'), 'utf8');
  const photo = fs.readFileSync(path.join(FIXTURES, 'images/photo.jpg'));

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/concepts/relationships') || url.includes('/api/media')) {
      await route.fallback();
      return;
    }
    if (
      url.includes('127.0.0.1') ||
      url.includes('localhost') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      await route.continue();
      return;
    }
    await route.abort();
  });

  await page.route('**/api/concepts/relationships', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: mushroom,
    });
  });

  await page.route('**/api/media**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: photo,
    });
  });
}

async function assertNoGuardBanners(page, screen) {
  for (const text of FAIL_CLOSED_GUARD_TEXTS) {
    const hit = page.getByText(text, { exact: false });
    if (await hit.first().isVisible().catch(() => false)) {
      throw new Error(
        `Web preview fail-closed: saw guard text "${text}" while capturing ${screen}`,
      );
    }
  }
}

async function prepareBasePage(page, base) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
  await installFixtureMocks(page);
  await page.goto(`${base}/?canonicalConcept=mushroom&locale=en`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await page.getByTestId('laterality-control').waitFor({ state: 'visible', timeout: 30_000 });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

async function openScreen(page, screen) {
  if (screen === 'CardFront' || screen === 'LateralityBar') {
    await page.getByTestId(SCREEN_READY[screen]).waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }
  if (screen === 'CardBack') {
    const front = page.locator('[data-testid="card-front-title"]:visible');
    if ((await front.count()) > 0) {
      await front.first().click();
    } else {
      await page.getByTestId('card-a11y-surface').click();
    }
    await page
      .getByTestId('card-a11y-surface')
      .getByTestId('card-back-copy')
      .waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }
  if (screen === 'AppMenu') {
    await page.getByTestId('app-menu-trigger').click();
    await page.getByTestId('app-menu').waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }
  throw new Error(`Unknown web preview screen: ${screen}`);
}

async function assertScreenVisible(page, screen) {
  const readyId = SCREEN_READY[screen];
  if (!readyId) throw new Error(`No ready testID for ${screen}`);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await assertNoGuardBanners(page, screen);
    const root = readyLocator(page, screen);
    if (await root.isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(250);
  }
  await assertNoGuardBanners(page, screen);
  throw new Error(`Web preview fail-closed: timed out waiting for testID=${readyId} on ${screen}`);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decode PNG IHDR + IDAT (8-bit RGB/RGBA) and measure colour diversity. */
export function analyzePngPaint(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) {
    throw new Error('not a PNG');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts = [];
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > buf.length) break;
    const data = buf.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }
  if (!width || !height) throw new Error('PNG missing IHDR');
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const inflated = inflateSync(Buffer.concat(idatParts));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const expected = (stride + 1) * height;
  if (inflated.length < expected) {
    throw new Error(`PNG IDAT too short: ${inflated.length} < ${expected}`);
  }

  const rgba = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart];
    const raw = inflated.subarray(rowStart + 1, rowStart + 1 + stride);
    const out = rgba.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? out[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      const x = raw[i];
      let val;
      switch (filter) {
        case 0:
          val = x;
          break;
        case 1:
          val = (x + left) & 0xff;
          break;
        case 2:
          val = (x + up) & 0xff;
          break;
        case 3:
          val = (x + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          val = (x + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
      out[i] = val;
    }
    prev = Buffer.from(out);
  }

  /** @type {Map<number, number>} */
  const counts = new Map();
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * bpp;
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      counts.set(key, (counts.get(key) || 0) + 1);
      total += 1;
    }
  }
  let dominantKey = 0;
  let dominantCount = 0;
  for (const [key, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantKey = key;
    }
  }
  const dominantHex = `#${dominantKey.toString(16).padStart(6, '0')}`;
  return {
    width,
    height,
    unique: counts.size,
    total,
    dominantShare: total > 0 ? dominantCount / total : 1,
    dominantHex,
  };
}

export function assertPaintNotBlank(stats, screen) {
  if (stats.unique < 50) {
    throw new Error(
      `Web preview fail-closed: ${screen} still near-uniform (unique colours=${stats.unique} < 50)`,
    );
  }
  if (stats.dominantShare > 0.98) {
    throw new Error(
      `Web preview fail-closed: ${screen} still near-uniform (${(stats.dominantShare * 100).toFixed(1)}% ${stats.dominantHex})`,
    );
  }
  if (stats.dominantHex === INSET_HEX && stats.dominantShare > 0.9) {
    throw new Error(
      `Web preview fail-closed: ${screen} still dominated by inset colour ${INSET_HEX} (${(stats.dominantShare * 100).toFixed(1)}%)`,
    );
  }
}

async function assertScreenshotHasPaint(filePath, screen) {
  const buf = await readFile(filePath);
  const stats = analyzePngPaint(buf);
  assertPaintNotBlank(stats, screen);
  console.log(
    `paint-ok ${screen}: unique=${stats.unique} dominant=${stats.dominantHex} ${(stats.dominantShare * 100).toFixed(1)}%`,
  );
}

async function main() {
  const base = (process.env.WEB_PREVIEW_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
  const outDir = process.env.WEB_PREVIEW_OUT_DIR || 'artifacts/web-preview-captures';
  const settleMs = Number(process.env.WEB_PREVIEW_SETTLE_MS || '2000');
  const screens = screensFromEnv();
  const fullSha = headSha();
  const sha = fullSha.slice(0, 12);

  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();
  const written = [];

  await prepareBasePage(page, base);

  for (const screen of screens) {
    console.log(`capturing ${screen}`);
    // Fresh navigation for each screen so fixtures + state stay deterministic.
    await prepareBasePage(page, base);
    await applyPhoneInsets(page);
    await openScreen(page, screen);
    await assertScreenVisible(page, screen);
    if (Number.isFinite(settleMs) && settleMs > 0) {
      await page.waitForTimeout(settleMs);
      await applyPhoneInsets(page);
      await assertScreenVisible(page, screen);
    }
    const file = path.join(outDir, `web-${WIDTH}x${HEIGHT}-${screen}-${sha}.png`);
    await page.screenshot({ path: file, fullPage: false });
    await assertScreenshotHasPaint(file, screen);
    written.push(file);
    console.log(`wrote ${file}`);
  }

  const usable = HEIGHT - INSET_TOP_PT - INSET_BOTTOM_PT;
  const manifest = [
    `commit=${fullSha}`,
    `platform=web-preview`,
    `viewport=${WIDTH}x${HEIGHT}`,
    `deviceScaleFactor=${DEVICE_SCALE_FACTOR}`,
    `insets=top${INSET_TOP_PT},bottom${INSET_BOTTOM_PT}`,
    `insetsNote=worst-case iPhone top 47 + Android nav bottom 48`,
    `usable≈${usable}pt`,
    `honesty=NOT native acceptance — Expo web / Chromium only`,
    `screens=${screens.join(',')}`,
    ...written.map((f) => `file=${f}`),
    '',
  ].join('\n');
  await writeFile(path.join(outDir, `manifest-web-${sha}.txt`), manifest, 'utf8');

  await browser.close();
}

const entry = process.argv[1] ? path.basename(process.argv[1]) : '';
const isMain = entry === 'capture-screens.mjs';

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
