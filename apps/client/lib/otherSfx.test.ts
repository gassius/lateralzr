/**
 * Sound 5 — other SFX mapping + index wiring (mocked lib/sound).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  cardArrivedSoundEvent,
  complexityChangedIfChanged,
  emitOtherSfx,
  errorSoftSoundEvent,
  isRandomLaterality,
  lateralityStepIfChanged,
  noMatchSoundEvent,
  RANDOM_LATERALITY_GRADE,
  reshuffleLandedSoundEvent,
  reshuffleStartedSoundEvent,
  sheetCloseSoundEvent,
  sheetOpenSoundEvent,
} from './otherSfx.ts';
import {
  BIG_MOVEMENT_SOUND_EVENTS,
  gainFromDb,
  REDUCED_MOTION_SFX_GAIN_DB,
  resolveEventGain,
  shouldShortenReducedMotionFade,
} from './soundMap.ts';
import {
  resolveReshuffleLandSource,
  scheduleReducedMotionFade,
} from './soundEngine.ts';
import { SOUND_ASSETS } from './soundAssets.ts';
import type { SoundEvent, SoundEventOptions } from './soundTypes.ts';

const here = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(here, '../app/index.tsx'), 'utf8');
const stackSrc = readFileSync(join(here, '../components/ConceptCardStack.tsx'), 'utf8');
const deckStatusSrc = readFileSync(
  join(here, '../components/DeckStatusLine.tsx'),
  'utf8',
);

function mockPlay() {
  const calls: { event: SoundEvent; options?: SoundEventOptions }[] = [];
  const play = (event: SoundEvent, options?: SoundEventOptions) => {
    calls.push({ event, options });
  };
  return { play, calls };
}

describe('otherSfx mapping', () => {
  it('emits complexity_changed only when the level changes', () => {
    assert.deepEqual(complexityChangedIfChanged(2, 4), {
      name: 'complexity_changed',
      level: 4,
    });
    assert.equal(complexityChangedIfChanged(3, 3), null);
    assert.equal(complexityChangedIfChanged(1, 0), null);
  });

  it('emits laterality_step only when the grade changes (1–5 ladder)', () => {
    assert.deepEqual(lateralityStepIfChanged(1, 5), {
      name: 'laterality_step',
      step: 5,
    });
    assert.equal(lateralityStepIfChanged(2, 2), null);
  });

  it('marks Random entry (grade 5) for wide land', () => {
    assert.equal(isRandomLaterality(RANDOM_LATERALITY_GRADE), true);
    assert.equal(isRandomLaterality(4), false);
    assert.deepEqual(reshuffleStartedSoundEvent(true), {
      name: 'reshuffle_started',
      random: true,
    });
    assert.deepEqual(reshuffleLandedSoundEvent(true), {
      name: 'reshuffle_landed',
      random: true,
    });
    assert.deepEqual(reshuffleLandedSoundEvent(false), {
      name: 'reshuffle_landed',
      random: false,
    });
  });

  it('maps sheet / error / no-match / card_arrived', () => {
    assert.deepEqual(sheetOpenSoundEvent(), { name: 'sheet_open' });
    assert.deepEqual(sheetCloseSoundEvent(), { name: 'sheet_close' });
    assert.deepEqual(errorSoftSoundEvent(), { name: 'error_soft' });
    assert.deepEqual(noMatchSoundEvent(), { name: 'no_match' });
    assert.deepEqual(cardArrivedSoundEvent(), { name: 'card_arrived' });
  });

  it('forwards through emitOtherSfx with reduceMotion', () => {
    const { play, calls } = mockPlay();
    emitOtherSfx(reshuffleLandedSoundEvent(true), play, { reduceMotion: true });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.event, { name: 'reshuffle_landed', random: true });
    assert.equal(calls[0]?.options?.reduceMotion, true);
  });
});

describe('reshuffle land + reduced-motion engine helpers', () => {
  it('picks wide land only for random: true', () => {
    assert.equal(
      resolveReshuffleLandSource({ name: 'reshuffle_landed', random: true }),
      SOUND_ASSETS['sfx-reshuffle-land-wide'].module,
    );
    assert.equal(
      resolveReshuffleLandSource({ name: 'reshuffle_landed', random: false }),
      null,
    );
  });

  it('applies ~3 dB + shortened fade for big-movement under RM', () => {
    assert.ok(BIG_MOVEMENT_SOUND_EVENTS.has('reshuffle_started'));
    assert.ok(BIG_MOVEMENT_SOUND_EVENTS.has('reshuffle_landed'));
    assert.ok(BIG_MOVEMENT_SOUND_EVENTS.has('sheet_open'));
    assert.ok(shouldShortenReducedMotionFade('sheet_close'));
    assert.equal(shouldShortenReducedMotionFade('card_flip'), false);

    const full = resolveEventGain(0, 'reshuffle_started', false);
    const rm = resolveEventGain(0, 'reshuffle_started', true);
    assert.ok(Math.abs(full - 1) < 1e-9);
    assert.ok(Math.abs(rm - gainFromDb(REDUCED_MOTION_SFX_GAIN_DB)) < 1e-9);
  });

  it('scheduleReducedMotionFade lowers volume then pauses', () => {
    const timers: Array<{ ms: number; fn: () => void }> = [];
    const player = {
      volume: 1,
      playing: true,
      play() {},
      pause() {
        this.playing = false;
      },
      replace() {},
      seekTo() {},
      release() {},
    };
    const cancel = scheduleReducedMotionFade(player, 1, 200, {
      playRatio: 0.5,
      fadeMs: 40,
      setTimeoutFn: ((fn: () => void, ms: number) => {
        timers.push({ ms, fn });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: (() => {}) as typeof clearTimeout,
    });
    assert.ok(timers.length >= 1);
    // Fire play-delay, then fade steps.
    const first = timers.shift();
    assert.ok(first);
    first.fn();
    while (timers.length > 0 && player.playing) {
      timers.shift()!.fn();
    }
    assert.equal(player.playing, false);
    assert.ok(player.volume <= 0.01);
    cancel();
  });
});

describe('index / stack / status wiring', () => {
  it('emits laterality_step, reshuffle gather once, land, card_arrived, sheet, error, no_match', () => {
    assert.match(indexSrc, /lateralityStepIfChanged/);
    assert.match(indexSrc, /reshuffleStartedSoundEvent\(random\)/);
    assert.match(indexSrc, /reshuffleLandedSoundEvent\(random\)/);
    assert.match(indexSrc, /cardArrivedSoundEvent\(\)/);
    assert.match(indexSrc, /sheetOpenSoundEvent\(\)/);
    assert.match(indexSrc, /sheetCloseSoundEvent\(\)/);
    assert.match(indexSrc, /errorSoftSoundEvent\(\)/);
    assert.match(indexSrc, /noMatchSoundEvent\(\)/);
    assert.match(indexSrc, /complexityChangedIfChanged/);
    // Gather once at start — not inside the shuffle timer.
    assert.match(
      indexSrc,
      /setLateralitySwap\(\{ token, phase: 'gather' \}\);\s*\/\/ Gather rings once[\s\S]*?playOtherSfx\(reshuffleStartedSoundEvent\(random\)\)/,
    );
    assert.doesNotMatch(
      indexSrc,
      /setLateralitySwap\(\{ token, phase: 'shuffle' \}\)[\s\S]{0,80}reshuffleStarted/,
    );
  });

  it('does not emit complexity from onSwipeForwardVertical (Sound 4 owns vertical)', () => {
    const swipeBlock = indexSrc.match(
      /const onSwipeForwardVertical = useCallback\([\s\S]*?\n  \);/,
    )?.[0];
    assert.ok(swipeBlock);
    assert.equal(/complexity_changed|complexityChangedIfChanged|playOtherSfx/.test(swipeBlock), false);
  });

  it('never plays card_arrived on forward swipe commits in the stack', () => {
    assert.equal(/card_arrived|cardArrived/.test(stackSrc), false);
  });

  it('wraps a11y status announce with Sound 7 begin/end hooks', () => {
    assert.match(deckStatusSrc, /beginSoundAnnouncement/);
    assert.match(deckStatusSrc, /endSoundAnnouncement/);
    assert.match(deckStatusSrc, /runAccessibilityAnnounce/);
  });
});
