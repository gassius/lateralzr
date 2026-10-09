import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS } from './helpers/viewports';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const DIST = path.join(__dirname, '..', 'dist');

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/../baselines/{projectName}/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    deviceScaleFactor: 2,
    trace: 'on-first-retry',
    screenshot: 'off',
    video: 'off',
  },
  projects: VIEWPORTS.map((vp) => ({
    name: vp.id,
    use: {
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      contextOptions: {
        reducedMotion: 'reduce',
      },
    },
  })),
  webServer: {
    command: `pnpm exec serve -s "${DIST}" -l tcp://127.0.0.1:${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
