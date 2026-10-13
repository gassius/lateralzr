import { expect, test, type Page } from '@playwright/test';
import { capture } from '../helpers/capture';
import { cardFrontPattern, visibleText } from '../helpers/locators';
import { openApp } from '../helpers/preparePage';

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

/**
 * Lz-40 connector pulse — structural only.
 * Peak/live opacity timing left to Critiquito screenshots, not hard asserts.
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
});
