import { expect, test, type Page } from '@playwright/test';
import {
  CONNECTOR_PULSE_FIRST_DELAY_MS,
} from '../../lib/connectorPulse';
import { motion } from '../../theme/tokens';
import { SWIPE_SETTLE_MS } from '../../lib/cardSwipe';
import { capture } from '../helpers/capture';
import { cardFrontPattern, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/** Past first delay + max cycle — long enough that a wrongly-enabled breath would light. */
const PAST_ONE_PULSE_MS =
  CONNECTOR_PULSE_FIRST_DELAY_MS + motion.pulseCycleMs[1] + 250;

type PulseDom = {
  ok: boolean;
  reason?: string;
  connectorGroupCount: number;
  fill: string | null;
};

/**
 * react-native-svg on web camelCases data-* (`dataConnector`), so do not query
 * `[data-connector]`. Pulse groups are direct `#connectors > g[id^="c"]`.
 */
async function readPulseDom(page: Page): Promise<PulseDom> {
  return page.evaluate(() => {
    const pattern = document.querySelector('[data-testid="card-front-pattern"]');
    if (!pattern) {
      return { ok: false, reason: 'missing pattern', connectorGroupCount: 0, fill: null };
    }
    const connectors = pattern.querySelector('#connectors');
    if (!connectors) {
      return { ok: false, reason: 'missing #connectors', connectorGroupCount: 0, fill: null };
    }
    const groups = connectors.querySelectorAll(':scope > g[id^="c"]');
    return {
      ok: true,
      connectorGroupCount: groups.length,
      fill: connectors.getAttribute('fill'),
    };
  });
}

async function readLitCount(page: Page, minOpacity = 0.01): Promise<number> {
  return page.evaluate((minOp) => {
    const connectors = document.querySelector(
      '[data-testid="card-front-pattern"] #connectors',
    );
    if (!connectors) return -1;
    const groups = Array.from(connectors.querySelectorAll(':scope > g[id^="c"]')) as SVGElement[];
    return groups.filter((g) => {
      if (g.getAttribute('display') === 'none') return false;
      return Number(g.getAttribute('fill-opacity') ?? '0') > minOp;
    }).length;
  }, minOpacity);
}

/**
 * Lz-40 connector pulse — structural + RM-off coverage.
 * Peak / live opacity timing is left to Critiquito screenshots, not hard asserts.
 */
test.describe('card front connector pulse', () => {
  test('pulse layer renders connectors (e2ePulsePeak)', async ({ page }, testInfo) => {
    await openApp(
      page,
      'canonicalConcept=mushroom&patternVariant=1&e2ePulsePeak=1',
    );
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    const pulse = await readPulseDom(page);
    expect(pulse.ok, JSON.stringify(pulse)).toBe(true);
    expect(pulse.connectorGroupCount, JSON.stringify(pulse)).toBeGreaterThan(0);
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

    expect(await readLitCount(page)).toBe(0);

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
    await page.clock.fastForward(SWIPE_SETTLE_MS + PAST_ONE_PULSE_MS);

    expect(await readLitCount(page)).toBe(0);

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-pulse-motion-reduced',
      locale: 'en',
    });
  });
});
