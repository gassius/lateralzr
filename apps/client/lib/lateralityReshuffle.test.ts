import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { motion } from '../theme/tokens.ts';
import { resolveReducedMotion } from './reducedMotion.ts';
import {
  RESHUFFLE_GATHER_DROP_PX,
  RESHUFFLE_GATHER_SCALE,
  reshuffleCardOffsetY,
  reshuffleCardScale,
  reshuffleCueFrame,
  reshuffleDealMs,
  reshuffleGatherMs,
  reshuffleMinCueMs,
  reshufflePhaseTargets,
  reshuffleReverseMs,
  reshuffleSilhouetteCount,
  reshuffleSilhouetteOffsetY,
  reshuffleSilhouetteOpacity,
  reshuffleSilhouetteScale,
  reshuffleStackFadeMs,
  reshuffleStatusDelayMs,
  reshuffleTimeoutMs,
  riffleFanDeg,
  riffleFanMix,
  riffleFanOffset,
  riffleStackZ,
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
    assert.equal(reshuffleStackFadeMs(false, 'gather'), 0);
    assert.equal(reshuffleStackFadeMs(false, 'shuffle'), 150);
    assert.equal(reshuffleStackFadeMs(false, 'deal'), 360);
    assert.equal(reshuffleStackFadeMs(false, 'reverse'), 260);
  });
});

describe('reshuffle card and cue motion', () => {
  it('sizes the cue to the card rect, not the stack slot surplus', () => {
    const frame = reshuffleCueFrame(
      { topSurplus: 69, width: 366, height: 512 },
      390,
    );
    assert.equal(frame.top, 69);
    assert.equal(frame.width, 366);
    assert.equal(frame.height, 512);
    assert.equal(frame.left, 12);
  });

  it('keeps the card visible through gather and deals it up from the deck', () => {
    const gather = reshufflePhaseTargets('gather', false);
    assert.equal(gather.cardOpacity, 1);
    assert.equal(gather.gather, 1);
    assert.equal(gather.deal, 0);
    assert.equal(reshuffleCardOffsetY(1, 0, 0), RESHUFFLE_GATHER_DROP_PX);
    assert.equal(reshuffleCardScale(1, 0, 0), RESHUFFLE_GATHER_SCALE);

    const dealt = reshufflePhaseTargets('deal', false);
    assert.equal(dealt.cardOpacity, 1);
    assert.equal(dealt.cueOpacity, 0);
    assert.equal(dealt.deal, 1);
    assert.equal(reshuffleCardOffsetY(1, 1, 0), 0);
    assert.equal(reshuffleCardScale(1, 1, 0), 1);
    assert.ok(reshuffleSilhouetteOffsetY(1, 1, 0) > reshuffleSilhouetteOffsetY(1, 0, 0));
    assert.equal(reshuffleSilhouetteScale(1), RESHUFFLE_GATHER_SCALE);
    assert.equal(reshuffleSilhouetteOpacity(0, 1, 1, 0), 0);
    assert.equal(reshuffleSilhouetteOpacity(1, 1, 1, 0), 0);
  });

  it('brings rear silhouettes in behind the card during gather', () => {
    assert.equal(reshuffleSilhouetteOpacity(0, 0.4, 0, 0), 0);
    assert.equal(reshuffleSilhouetteOpacity(1, 0.4, 0, 0), 0.4);
    assert.equal(reshuffleSilhouetteOpacity(2, 0.4, 0, 0), 0.4);
    assert.equal(reshuffleSilhouetteOpacity(0, 1, 0, 0), 1);
  });

  it('treats reverse like deal: card lifts, cue sinks and fades', () => {
    const reverse = reshufflePhaseTargets('reverse', false);
    assert.equal(reverse.cardOpacity, 1);
    assert.equal(reverse.cueOpacity, 0);
    assert.equal(reshuffleCardOffsetY(1, 0, 1), 0);
    assert.ok(reshuffleSilhouetteOffsetY(1, 0, 1) > RESHUFFLE_GATHER_DROP_PX);
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

  it('swaps stacking order at the midpoint of each riffle tick', () => {
    assert.equal(riffleStackZ(0, 3, 0), 3);
    assert.equal(riffleStackZ(2, 3, 0), 1);
    assert.equal(riffleStackZ(0, 3, 0.49), 3);
    assert.equal(riffleStackZ(0, 3, 0.5), 1);
    assert.equal(riffleStackZ(2, 3, 1), 3);
    assert.equal(riffleStackZ(0, 3, 1), 1);
  });

  it('marks riffle helpers as worklets for the Silhouette UI thread', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'lateralityReshuffle.ts'), 'utf8');
    for (const name of [
      'riffleFanMix',
      'riffleFanOffset',
      'riffleFanDeg',
      'riffleStackZ',
      'reshuffleCardOffsetY',
      'reshuffleCardScale',
      'reshuffleSilhouetteOffsetY',
      'reshuffleSilhouetteScale',
      'reshuffleSilhouetteOpacity',
    ] as const) {
      const match = src.match(new RegExp(`export function ${name}[^{]+\\{\\n  'worklet';`));
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
