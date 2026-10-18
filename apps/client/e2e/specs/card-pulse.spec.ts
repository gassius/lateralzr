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
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(1);

    const pulse = await readPulseDom(page);
    expect(pulse.ok, JSON.stringify(pulse)).toBe(true);
    expect(pulse.connectorGroupCount, JSON.stringify(pulse)).toBeGreaterThan(0);
    expect(pulse.fill).toBe('#FFC98A');

    // AD-only artifact for Critiquito — settle/baseline noise must not fail CI.
    try {
      await capture(page, testInfo, {
        screen: 'card-front',
        state: 'pattern-pulse-peak',
        locale: 'en',
      });
    } catch (err) {
      testInfo.annotations.push({
        type: 'ad-capture-soft',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  });

  test('glow scheduler stays off under OS reduced motion', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-idle')).toHaveCount(1);
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(0);
    const pulse = await readPulseDom(page);
    expect(pulse.ok, JSON.stringify(pulse)).toBe(true);
    expect(pulse.connectorGroupCount).toBeGreaterThan(0);
  });
});

test.describe('card front connector pulse — Motion reduced', () => {
  // Project default lives on `contextOptions.reducedMotion`; the first-class
  // option alone does not override it.
  test.use({
    reducedMotion: 'no-preference',
    contextOptions: { reducedMotion: 'no-preference' },
  });

  test('glow stays off when Motion is Reduced', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await page.getByTestId('app-menu-trigger').click();
    await expect(page.getByTestId('app-menu')).toBeVisible();
    await page.getByTestId('app-menu-row-motion').click();
    await page.getByTestId('app-menu-motion-row-reduced').click();
    await expect(page.getByTestId('app-menu-rows')).toBeVisible();
    await page.getByTestId('app-menu-close').click();
    await expect(page.getByTestId('app-menu')).toHaveCount(0);
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-idle')).toHaveCount(1);
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(0);
  });

  test('glow is armed under no-preference Motion system', async ({ page }) => {
    await openApp(page, 'canonicalConcept=mushroom&patternVariant=1');
    await expect(cardFrontPattern(page)).toBeAttached();
    await expect(page.getByTestId('card-front-pulse-armed')).toHaveCount(1);
    await expect(page.getByTestId('card-front-pulse-idle')).toHaveCount(0);
  });
});
