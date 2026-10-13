import { expect, test } from '@playwright/test';
import { CONNECTOR_PULSE_PEAK_OPACITY } from '../../lib/connectorPulse';
import { capture } from '../helpers/capture';
import { cardFrontPattern, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

/**
 * Lz-40 connector pulse — peak snapshot via `?e2ePulsePeak=1` (E2E always sets
 * OS reducedMotion=reduce, which keeps the live breath fully off).
 */
test.describe('card front connector pulse', () => {
  test('peak breath on variant 01 (e2ePulsePeak)', async ({ page }, testInfo) => {
    await openApp(
      page,
      'canonicalConcept=mushroom&patternVariant=1&e2ePulsePeak=1',
    );
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    const pulse = await page.evaluate((peak) => {
      const pattern = document.querySelector('[data-testid="card-front-pattern"]');
      if (!pattern) return { ok: false, reason: 'missing pattern' };
      const connectors = pattern.querySelector('#connectors');
      if (!connectors) return { ok: false, reason: 'missing #connectors' };
      const groups = Array.from(
        connectors.querySelectorAll(':scope > g[data-connector]'),
      ) as SVGElement[];
      const lit = groups.filter((g) => {
        if (g.getAttribute('display') === 'none') return false;
        return Number(g.getAttribute('fill-opacity') ?? '0') > peak * 0.5;
      });
      if (lit.length !== 1) {
        return {
          ok: false,
          reason: `expected 1 lit connector, got ${lit.length}`,
          ids: lit.map((g) => g.id),
        };
      }
      const g = lit[0]!;
      return {
        ok: true,
        id: g.id,
        opacity: Number(g.getAttribute('fill-opacity')),
        fill: connectors.getAttribute('fill'),
      };
    }, CONNECTOR_PULSE_PEAK_OPACITY);

    expect(pulse.ok, JSON.stringify(pulse)).toBe(true);
    expect(pulse.opacity).toBeCloseTo(CONNECTOR_PULSE_PEAK_OPACITY, 3);
    expect(pulse.fill).toBe('#FFB867');

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-pulse-peak',
      locale: 'en',
    });
  });

  test('pulse stays off under reduced motion (default e2e)', async ({ page }, testInfo) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(visibleText(page, 'Mushroom')).toBeVisible();
    await expect(cardFrontPattern(page)).toBeAttached();

    const resting = await page.evaluate(() => {
      const pattern = document.querySelector('[data-testid="card-front-pattern"]');
      if (!pattern) return { ok: false, reason: 'missing pattern' };
      const groups = Array.from(
        pattern.querySelectorAll('#connectors > g[data-connector]'),
      );
      const lit = groups.filter((g) => {
        const op = Number(g.getAttribute('fill-opacity') ?? '0');
        return op > 0.01;
      });
      return { ok: lit.length === 0, lit: lit.map((g) => g.id) };
    });

    expect(resting.ok, JSON.stringify(resting)).toBe(true);

    await capture(page, testInfo, {
      screen: 'card-front',
      state: 'pattern-pulse-off',
      locale: 'en',
    });
  });
});
