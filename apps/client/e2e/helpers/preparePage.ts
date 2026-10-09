import type { ConsoleMessage, Page } from '@playwright/test';
import { FIXED_CLOCK_ISO, INTRO_FAST_FORWARD_MS } from './viewports';
import { installApiMocks, type MockOptions } from './mockApi';

const DISABLE_MOTION_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
`;

export type ConsoleBucket = {
  errors: string[];
  pageErrors: string[];
};

export type OpenAppOptions = {
  mock?: MockOptions;
  /** Skip networkidle — required when a mock holds a request open (loading deck). */
  skipNetworkIdle?: boolean;
};

export function attachConsoleBucket(page: Page): ConsoleBucket {
  const bucket: ConsoleBucket = { errors: [], pageErrors: [] };
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      bucket.errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    bucket.pageErrors.push(String(err));
  });
  return bucket;
}

export async function preparePage(page: Page, mock?: MockOptions): Promise<ConsoleBucket> {
  const bucket = attachConsoleBucket(page);
  await installApiMocks(page, mock);
  await page.clock.install({ time: new Date(FIXED_CLOCK_ISO) });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
  return bucket;
}

export async function disableMotionCss(page: Page): Promise<void> {
  await page.addStyleTag({ content: DISABLE_MOTION_CSS });
}

export async function settleAfterNavigation(
  page: Page,
  options: { skipNetworkIdle?: boolean } = {},
): Promise<void> {
  await page.clock.fastForward(INTRO_FAST_FORWARD_MS);
  await page.locator('[data-testid="card-laterality-group"]').waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await disableMotionCss(page);
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      await fonts.ready;
    }
    const images = Array.from(document.images);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }),
    );
  });
  if (!options.skipNetworkIdle) {
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
  // Deck chrome visible = settled enough for captures (avoid clock.fastForward — it breaks RNGH).
  await page.getByTestId('laterality-submenu').waitFor({ state: 'visible', timeout: 5_000 });
}

export async function openApp(
  page: Page,
  search: string,
  options: OpenAppOptions = {},
): Promise<ConsoleBucket> {
  const bucket = await preparePage(page, options.mock);
  const path = search.startsWith('?') ? `/${search}` : `/?${search}`;
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await settleAfterNavigation(page, { skipNetworkIdle: options.skipNetworkIdle });
  return bucket;
}
