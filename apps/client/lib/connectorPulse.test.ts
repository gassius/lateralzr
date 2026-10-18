import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyConnectorPulseOpacity,
  assertPulseGlowFill,
  CONNECTOR_PULSE_GLOW_FILL,
  CONNECTOR_PULSE_PEAK_OPACITY,
  connectorPulseAllowed,
  connectorPulseTiming,
  listVisiblePulseConnectors,
  pickPulseConnectorId,
  pulseOpacityAt,
  randomIntInclusive,
  randomPulseCycleMs,
  randomPulsePauseMs,
  readConnectorPulseOpacity,
} from './connectorPulse.ts';
import {
  buildPatternSvgXml,
  defaultTitleClearForVariant,
  patternSvgForVariant,
} from './patternPlacement.ts';
import { PATTERN_VARIANT_PLACEMENTS } from './patternVariantPlacements.ts';
import { motion } from '@/theme/tokens';
import { PATTERN_PULSE_GLOW_FILL } from '@/theme/pattern';

describe('connectorPulse tokens', () => {
  it('pins cycle/pause/concurrent to section23 glow tokens', () => {
    const t = connectorPulseTiming();
    assert.deepEqual(t.cycleMs, [motion.glow.cycleMs, motion.glow.cycleMs]);
    assert.deepEqual(t.pauseMs, motion.glow.pauseMs);
    assert.equal(t.concurrentPulses, 1);
    assert.equal(t.peakOpacity, CONNECTOR_PULSE_PEAK_OPACITY);
    assert.equal(t.firstDelayMs, 1500);
    assert.equal(CONNECTOR_PULSE_PEAK_OPACITY, 0.55);
    assert.ok(CONNECTOR_PULSE_PEAK_OPACITY >= 0.45 && CONNECTOR_PULSE_PEAK_OPACITY <= 0.6);
  });

  it('glow fill stays warm light orange (never white/cyan)', () => {
    assert.equal(CONNECTOR_PULSE_GLOW_FILL, PATTERN_PULSE_GLOW_FILL);
    assert.equal(CONNECTOR_PULSE_GLOW_FILL, '#FFC98A');
    assert.ok(assertPulseGlowFill(patternSvgForVariant(0)));
  });
});

describe('connectorPulseAllowed', () => {
  const open = {
    settled: true,
    frontShowing: true,
    dragging: false,
    scrolling: false,
    sheetOpen: false,
    appActive: true,
    reduceMotion: false,
  };

  it('allows only when settled, front, idle, active, and motion on', () => {
    assert.equal(connectorPulseAllowed(open), true);
  });

  it('blocks under reduced motion / Motion preference', () => {
    assert.equal(connectorPulseAllowed({ ...open, reduceMotion: true }), false);
  });

  it('blocks on flip, drag, scroll, sheet, unsettled, and background', () => {
    assert.equal(connectorPulseAllowed({ ...open, frontShowing: false }), false);
    assert.equal(connectorPulseAllowed({ ...open, dragging: true }), false);
    assert.equal(connectorPulseAllowed({ ...open, scrolling: true }), false);
    assert.equal(connectorPulseAllowed({ ...open, sheetOpen: true }), false);
    assert.equal(connectorPulseAllowed({ ...open, settled: false }), false);
    assert.equal(connectorPulseAllowed({ ...open, appActive: false }), false);
    assert.equal(connectorPulseAllowed({ ...open, reshuffling: true }), false);
  });
});

describe('pulseOpacityAt', () => {
  it('starts and ends at 0 and peaks mid-cycle', () => {
    assert.equal(pulseOpacityAt(0), 0);
    assert.equal(pulseOpacityAt(1), 0);
    const mid = pulseOpacityAt(0.5);
    assert.ok(Math.abs(mid - CONNECTOR_PULSE_PEAK_OPACITY) < 1e-9);
    assert.ok(pulseOpacityAt(0.25) > 0);
    assert.ok(pulseOpacityAt(0.75) > 0);
  });
});

describe('random ranges', () => {
  it('cycle and pause stay inside token ranges', () => {
    const rnd = (() => {
      let i = 0;
      const seq = [0, 0.5, 0.999, 0.25, 0.75];
      return () => seq[i++ % seq.length]!;
    })();
    for (let n = 0; n < 5; n += 1) {
      const cycle = randomPulseCycleMs(rnd);
      assert.equal(cycle, motion.glow.cycleMs);
      const pause = randomPulsePauseMs(rnd);
      assert.ok(pause >= motion.glow.pauseMs[0] && pause <= motion.glow.pauseMs[1]);
    }
    assert.equal(randomIntInclusive(8, 8), 8);
  });
});

describe('list / pick / apply connector opacity', () => {
  it('lists only visible pulse groups after title clearing', () => {
    const raw = patternSvgForVariant(0);
    const all = listVisiblePulseConnectors(raw);
    assert.equal(all.length, PATTERN_VARIANT_PLACEMENTS[0].connectors.length);

    const built = buildPatternSvgXml({
      conceptKey: 'mushroom',
      titleFaceRect: { x: 20, y: 200, width: 300, height: 160 },
      faceWidth: 358,
      faceHeight: 560,
      variantOverride: 0,
    });
    const visible = listVisiblePulseConnectors(built.xml);
    assert.ok(visible.length < all.length);
    assert.ok(visible.length > 0);
    for (const c of visible) {
      assert.match(c.id, /^c\d+$/);
      assert.match(c.motifId, /^m\d+$/);
    }
  });

  it('picks a stable connector away from the title clear', () => {
    const built = buildPatternSvgXml({
      conceptKey: 'mushroom',
      titleFaceRect: null,
      faceWidth: 358,
      faceHeight: 560,
      variantOverride: 0,
    });
    const clear = defaultTitleClearForVariant(0);
    const a = pickPulseConnectorId({
      xml: built.xml,
      variant: 0,
      clearArea: clear,
      conceptKey: 'mushroom',
    });
    const b = pickPulseConnectorId({
      xml: built.xml,
      variant: 0,
      clearArea: clear,
      conceptKey: 'mushroom',
    });
    assert.ok(a);
    assert.equal(a, b);
    const opacity = readConnectorPulseOpacity(built.xml, a!);
    assert.equal(opacity, 0);
  });

  it('applies opacity without moving geometry or changing glow fill', () => {
    const built = buildPatternSvgXml({
      conceptKey: 'tide',
      titleFaceRect: null,
      faceWidth: 358,
      faceHeight: 560,
      variantOverride: 1,
    });
    const id = pickPulseConnectorId({
      xml: built.xml,
      variant: 1,
      clearArea: defaultTitleClearForVariant(1),
      conceptKey: 'tide',
    });
    assert.ok(id);
    const next = applyConnectorPulseOpacity(built.xml, id!, CONNECTOR_PULSE_PEAK_OPACITY);
    assert.equal(readConnectorPulseOpacity(next, id!), CONNECTOR_PULSE_PEAK_OPACITY);
    assert.ok(assertPulseGlowFill(next));
    // Geometry: inter-bulb line endpoints unchanged.
    const lineRe = new RegExp(
      `<g\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<line class="core"([^/]*)/>`,
    );
    const before = lineRe.exec(built.xml)?.[1];
    const after = lineRe.exec(next)?.[1];
    assert.equal(before, after);
    const rest = applyConnectorPulseOpacity(next, id!, 0);
    assert.equal(readConnectorPulseOpacity(rest, id!), 0);
  });
});
