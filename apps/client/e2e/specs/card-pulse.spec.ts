import { expect, test, type Page } from '@playwright/test';
import {
  CONNECTOR_PULSE_FIRST_DELAY_MS,
  CONNECTOR_PULSE_PEAK_OPACITY,
} from '../../lib/connectorPulse';
import { motion } from '../../theme/tokens';
import { SWIPE_SETTLE_MS } from '../../lib/cardSwipe';
import { capture } from '../helpers/capture';
import { cardFrontPattern, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/** Past first delay + max cycle — long enough that a wrongly-enabled breath would light. */
const PAST_ONE_PULSE_MS =
  CONNECTOR_PULSE_FIRST_DELAY_MS + motion.pulseCycleMs[1] + 250;

type LitPulse = {
  ok: boolean;
  reason?: string;
  count: number;
  ids: string[];
  maxOpacity: number;
  fill: string | null;
};

async function readLitConnectors(page: Page, minOpacity = 0.01): Promise<LitPulse> {
  return page.evaluate((minOp) => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) return { ok: false, reason: 'missing pattern', count: 0, ids: [], maxOpacity: 0, fill: null };
    const connectors = pattern.querySelector('#connectors');
    if (!connectors) {
      return { ok: false, reason: 'missing #connectors', count: 0, ids: [], maxOpacity: 0, fill: null };
    }
    const groups = Array.from(
      connectors.querySelectorAll(':scope > g[data-connector]'),
    ) as SVGElement[];
    let maxOpacity = 0;
    const lit = groups.filter((g) => {
      if (g.getAttribute('display') === 'none') return false;
      const op = Number(g.getAttribute('fill-opacity') ?? '0');
      if (op > maxOpacity) maxOpacity = op;
      return op > minOp;
    });
    return {
      ok: true,
      count: lit.length,
      ids: lit.map((g) => g.id),
      maxOpacity,
      fill: connectors.getAttribute('fill'),
    };
  }, minOpacity);
}

/**
 * Lz-40 connector pulse.
 * Default Playwright projects set OS `reducedMotion: reduce`.
 * Peak snapshot uses `?e2ePulsePeak=1` (test/dev builds only — EXPO_PUBLIC_E2E=1).
 */
test.describe('card front connector pulse', () => {
  test('peak breath on variant 01 (e2ePulsePeak)', async ({ page }, testInfo) => {
    await openApp(
      page,
      'canonicalConcept=mushroom&patternVariant=1&e2ePulsePeak=1',
    );
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    const pulse = await readLitConnectors(page, CONNECTOR_PULSE_PEAK_OPACITY * 0.5);
    expect(pulse.ok, JSON.stringify(pulse)).toBe(true);
    expect(pulse.count).toBe(1);
    expect(pulse.maxOpacity).toBeCloseTo(CONNECTOR_PULSE_PEAK_OPACITY, 3);
    expect(pulse.fill).toBe('#FFB867');

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-pulse-peak',
      locale: 'en',
    });
  });

  test('pulse stays off under OS reduced motion after a full cycle window', async ({
    page,
  }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    // B1: advance past first-delay + max cycle so a missing RM guard would light a connector.
    await page.clock.fastForward(PAST_ONE_PULSE_MS);

    const resting = await readLitConnectors(page);
    expect(resting.ok, JSON.stringify(resting)).toBe(true);
    expect(resting.count, JSON.stringify(resting)).toBe(0);

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-pulse-off',
      locale: 'en',
    });
  });

  test('pulse stays off when app Motion=Reduced and OS allows motion', async ({
    page,
  }, testInfo) => {
    // B2: OS no-preference; in-app Motion Reduced must still kill the breath.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();

    await page.getByTestId('app-menu-trigger').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await page.getByTestId('app-menu-row-motion').click();
    await page.getByTestId('app-menu-motion-row-reduced').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await page.getByTestId('app-menu-close').click();
    await expect(page.getByTestId('app-menu')).toHaveCount(0);

    await expect(cardFrontPattern(page)).toBeAttached();
    // Settle + first delay + max cycle under a wrongly-open gate.
    await page.clock.fastForward(SWIPE_SETTLE_MS + PAST_ONE_PULSE_MS);

    const resting = await readLitConnectors(page);
    expect(resting.ok, JSON.stringify(resting)).toBe(true);
    expect(resting.count, JSON.stringify(resting)).toBe(0);

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-pulse-motion-reduced',
      locale: 'en',
    });
  });
});

test.describe('card front connector pulse (motion allowed)', () => {
  // B1 control: OS allows motion so the live breath can run.
  test.use({
    contextOptions: {
      reducedMotion: 'no-preference',
    },
  });

  test('live breath appears after settle when motion is allowed', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    // Full-motion settle, then first delay, then into the fade-in half of the cycle.
    await page.clock.fastForward(SWIPE_SETTLE_MS);
    await page.clock.fastForward(CONNECTOR_PULSE_FIRST_DELAY_MS);
    await page.clock.fastForward(Math.floor(motion.pulseCycleMs[0] / 2));

    // React state from rAF ticks may flush a frame after the clock jump.
    await expect
      .poll(async () => (await readLitConnectors(page, 0.02)).count, { timeout: 3_000 })
      .toBe(1);

    const lit = await readLitConnectors(page, 0.02);
    expect(lit.maxOpacity).toBeGreaterThan(0.02);
    expect(lit.fill).toBe('#FFB867');
  });
});
