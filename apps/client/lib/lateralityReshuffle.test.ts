import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { motion } from '../theme/tokens.ts';
import { resolveReducedMotion } from './reducedMotion.ts';
import {
  reshuffleDealMs,
  reshuffleGatherMs,
  reshuffleMinCueMs,
  reshuffleReverseMs,
  reshuffleSilhouetteCount,
  reshuffleStackFadeMs,
  reshuffleStatusDelayMs,
  reshuffleTimeoutMs,
  riffleFanDeg,
  riffleFanMix,
  riffleFanOffset,
  withTimeout,
} from './lateralityReshuffle.ts';

describe('laterality reshuffle timing tokens', () => {
  it('pins §23 reshuffle timings', () => {
    assert.equal(reshuffleStatusDelayMs(), 300);
    assert.equal(reshuffleMinCueMs(), 900);
    assert.equal(reshuffleTimeoutMs(), 10000);
    assert.equal(motion.reshuffle.cardInputDuringShuffle, false);
  });

  it('uses a single silhouette crossfade under reduced motion', () => {
    assert.equal(reshuffleSilhouetteCount(true), 1);
    assert.equal(reshuffleSilhouetteCount(false), 3);
    assert.equal(reshuffleGatherMs(true), 0);
    assert.equal(reshuffleGatherMs(false), 260);
    assert.equal(reshuffleDealMs(true), 150);
    assert.equal(reshuffleDealMs(false), 360);
    assert.equal(reshuffleReverseMs(true), 150);
    assert.equal(reshuffleReverseMs(false), 260);
  });

  it('uses reduced-motion cue timings when OS reduce-motion is on', () => {
    const reduceMotion = resolveReducedMotion({
      os: true,
      web: false,
      appPref: 'full',
    });
    assert.equal(reduceMotion, true);
    assert.equal(reshuffleGatherMs(reduceMotion), 0);
    assert.equal(reshuffleDealMs(reduceMotion), 150);
    assert.equal(reshuffleReverseMs(reduceMotion), 150);
    assert.equal(reshuffleSilhouetteCount(reduceMotion), 1);
    assert.equal(reshuffleStackFadeMs(reduceMotion, 'gather'), 150);
    assert.equal(reshuffleStackFadeMs(reduceMotion, 'deal'), 150);
    assert.equal(reshuffleStackFadeMs(reduceMotion, 'reverse'), 150);
    assert.equal(reshuffleStackFadeMs(false, 'gather'), 260);
    assert.equal(reshuffleStackFadeMs(false, 'deal'), 360);
    assert.equal(reshuffleStackFadeMs(false, 'reverse'), 260);
  });
});

describe('riffle interpolation', () => {
  it('interpolates between even and odd fans without snapping at 0.5', () => {
    const even = riffleFanOffset(0, 0);
    const odd = riffleFanOffset(0, 1);
    const mid = riffleFanOffset(0, 0.5);
    assert.equal(riffleFanMix(0), 0);
    assert.equal(riffleFanMix(1), 1);
    assert.equal(riffleFanMix(0.5), 0.5);
    assert.equal(mid, (even + odd) / 2);
    assert.notEqual(mid, even);
    assert.notEqual(mid, odd);
    assert.equal(riffleFanDeg(0, 0.5), (riffleFanDeg(0, 0) + riffleFanDeg(0, 1)) / 2);
  });

  it('marks riffle helpers as worklets for the Silhouette UI thread', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'lateralityReshuffle.ts'), 'utf8');
    for (const name of ['riffleFanMix', 'riffleFanOffset', 'riffleFanDeg'] as const) {
      const match = src.match(new RegExp(`export function ${name}\\([^)]*\\): number \\{\\n  'worklet';`));
      assert.ok(match, `${name} must start with 'worklet'`);
    }
  });
});

describe('withTimeout', () => {
  it('rejects with reshuffle-timeout when the wait exceeds the budget', async () => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 5),
      /reshuffle-timeout/,
    );
  });
});
