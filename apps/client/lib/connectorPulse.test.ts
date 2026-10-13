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
import { motion } from '@/theme/tokens';
import { PATTERN_PULSE_GLOW_FILL } from '@/theme/pattern';

describe('connectorPulse tokens', () => {
  it('pins cycle/pause/concurrent to section23 motion tokens', () => {
    const t = connectorPulseTiming();
    assert.deepEqual(t.cycleMs, motion.pulseCycleMs);
    assert.deepEqual(t.pauseMs, motion.pulsePauseMs);
    assert.equal(t.concurrentPulses, 1);
    assert.equal(t.peakOpacity, CONNECTOR_PULSE_PEAK_OPACITY);
    assert.ok(CONNECTOR_PULSE_PEAK_OPACITY > 0 && CONNECTOR_PULSE_PEAK_OPACITY < 0.4);
  });

  it('glow fill stays pattern pulse orange (never white/cyan)', () => {
    assert.equal(CONNECTOR_PULSE_GLOW_FILL, PATTERN_PULSE_GLOW_FILL);
    assert.equal(CONNECTOR_PULSE_GLOW_FILL, '#FFB867');
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
      assert.ok(cycle >= motion.pulseCycleMs[0] && cycle <= motion.pulseCycleMs[1]);
      const pause = randomPulsePauseMs(rnd);
      assert.ok(pause >= motion.pulsePauseMs[0] && pause <= motion.pulsePauseMs[1]);
    }
    assert.equal(randomIntInclusive(8, 8), 8);
  });
});

describe('list / pick / apply connector opacity', () => {
  it('lists only visible pulse groups after title clearing', () => {
    const raw = patternSvgForVariant(0);
    const all = listVisiblePulseConnectors(raw);
    assert.equal(all.length, 48);

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
    // Geometry: use href + transform for that connector unchanged.
    const useRe = new RegExp(
      `<g\\b[^>]*\\bid="${id}"[^>]*>\\s*<use\\b([^/]*)/>`,
    );
    const before = useRe.exec(built.xml)?.[1];
    const after = useRe.exec(next)?.[1];
    assert.equal(before, after);
    const rest = applyConnectorPulseOpacity(next, id!, 0);
    assert.equal(readConnectorPulseOpacity(rest, id!), 0);
  });
});
