/**
 * Sound 4 — card-stack SFX mapping + stack wiring.
 * Mocks `lib/sound` via an injectable `play` spy (no expo-audio in node:test).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  emitCardStackSound,
  flipSoundEvent,
  horizontalSwipeSoundEvent,
  shouldEmitSwipeCancel,
  shouldEmitSwipeResistance,
  SWIPE_CANCEL_SOUND_THRESHOLD_PX,
  verticalSwipeSoundEvent,
} from './cardStackSound.ts';
import type { SoundEvent, SoundEventOptions } from './soundTypes.ts';
import {
  ENABLE_SWIPE_TONE_LAYERS,
  gainFromDb,
  MOTION_TIED_SOUND_EVENTS,
  REDUCED_MOTION_SFX_GAIN_DB,
  resolveEventGain,
  SWIPE_TONE_LAYER_GAIN_DB,
} from './soundMap.ts';

const here = dirname(fileURLToPath(import.meta.url));
const stackSrc = readFileSync(join(here, '../components/ConceptCardStack.tsx'), 'utf8');

function mockPlay() {
  const calls: { event: SoundEvent; options?: SoundEventOptions }[] = [];
  const play = (event: SoundEvent, options?: SoundEventOptions) => {
    calls.push({ event, options });
  };
  return { play, calls };
}

describe('horizontal / vertical / flip mapping', () => {
  it('maps left → swipe_next and right → swipe_back', () => {
    assert.deepEqual(horizontalSwipeSoundEvent('left'), { name: 'swipe_next' });
    assert.deepEqual(horizontalSwipeSoundEvent('right'), { name: 'swipe_back' });
  });

  it('maps vertical commit to complexity_changed only (no air sweep)', () => {
    assert.deepEqual(verticalSwipeSoundEvent(3), {
      name: 'complexity_changed',
      level: 3,
    });
    assert.deepEqual(verticalSwipeSoundEvent(0), {
      name: 'complexity_changed',
      level: 1,
    });
    assert.deepEqual(verticalSwipeSoundEvent(9), {
      name: 'complexity_changed',
      level: 5,
    });
  });

  it('maps flip to back / front', () => {
    assert.deepEqual(flipSoundEvent(true), { name: 'card_flip' });
    assert.deepEqual(flipSoundEvent(false), { name: 'card_flip_back' });
  });
});

describe('cancel / resistance thresholds (no sound during drag)', () => {
  it('stays silent below the cancel threshold (taps)', () => {
    assert.equal(shouldEmitSwipeCancel(0), false);
    assert.equal(shouldEmitSwipeCancel(SWIPE_CANCEL_SOUND_THRESHOLD_PX - 1), false);
    assert.equal(shouldEmitSwipeCancel(-(SWIPE_CANCEL_SOUND_THRESHOLD_PX - 1)), false);
  });

  it('fires cancel at or above the threshold', () => {
    assert.equal(shouldEmitSwipeCancel(SWIPE_CANCEL_SOUND_THRESHOLD_PX), true);
    assert.equal(shouldEmitSwipeCancel(-40), true);
  });

  it('fires resistance only for rightward drag at first card past threshold', () => {
    assert.equal(shouldEmitSwipeResistance(40, true), false);
    assert.equal(shouldEmitSwipeResistance(40, false), true);
    assert.equal(shouldEmitSwipeResistance(-40, false), false);
    assert.equal(shouldEmitSwipeResistance(10, false), false);
  });
});

describe('emitCardStackSound (mocked lib/sound)', () => {
  it('forwards gesture commit events with options', () => {
    const { play, calls } = mockPlay();
    emitCardStackSound(horizontalSwipeSoundEvent('left'), play, { reduceMotion: true });
    emitCardStackSound(horizontalSwipeSoundEvent('right'), play);
    emitCardStackSound(verticalSwipeSoundEvent(4), play, { reduceMotion: false });
    emitCardStackSound(flipSoundEvent(true), play);
    emitCardStackSound(flipSoundEvent(false), play);
    emitCardStackSound({ name: 'swipe_cancel' }, play);
    emitCardStackSound({ name: 'swipe_resistance' }, play);

    assert.deepEqual(
      calls.map((c) => c.event.name),
      [
        'swipe_next',
        'swipe_back',
        'complexity_changed',
        'card_flip',
        'card_flip_back',
        'swipe_cancel',
        'swipe_resistance',
      ],
    );
    assert.equal(calls[0]?.options?.reduceMotion, true);
    assert.equal(calls[2]?.event.name, 'complexity_changed');
    if (calls[2]?.event.name === 'complexity_changed') {
      assert.equal(calls[2].event.level, 4);
    }
  });

  it('does not invent drag-frame / glow / tooltip / card_arrived events', () => {
    const { play, calls } = mockPlay();
    // Simulates: only commit helpers + cancel/resistance call emit — never onUpdate.
    assert.equal(calls.length, 0);
    emitCardStackSound(horizontalSwipeSoundEvent('left'), play);
    assert.equal(calls.length, 1);
    assert.notEqual(calls[0]?.event.name, 'card_arrived');
  });
});

describe('tone layers + reduced-motion gain (soundMap)', () => {
  it('keeps tone layers OFF by default (QA flag, not a user setting)', () => {
    assert.equal(ENABLE_SWIPE_TONE_LAYERS, false);
  });

  it('applies ~3 dB quieter gain for motion-tied SFX under reduced motion', () => {
    assert.ok(MOTION_TIED_SOUND_EVENTS.has('swipe_next'));
    assert.ok(MOTION_TIED_SOUND_EVENTS.has('complexity_changed'));
    const full = resolveEventGain(0, 'swipe_next', false);
    const rm = resolveEventGain(0, 'swipe_next', true);
    assert.ok(Math.abs(full - 1) < 1e-9);
    assert.ok(Math.abs(rm - gainFromDb(REDUCED_MOTION_SFX_GAIN_DB)) < 1e-9);
    assert.equal(SWIPE_TONE_LAYER_GAIN_DB, -10);
  });
});

describe('ConceptCardStack wiring (gesture / keyboard / a11y share commit*)', () => {
  it('emits from commitSwipe* next to analytics (covers gesture + keyboard + a11y)', () => {
    assert.match(stackSrc, /playStackSound\(horizontalSwipeSoundEvent\('left'\)\)/);
    assert.match(stackSrc, /playStackSound\(horizontalSwipeSoundEvent\('right'\)\)/);
    assert.match(stackSrc, /playStackSound\(verticalSwipeSoundEvent\(complexityAfter\)\)/);
    assert.match(stackSrc, /trackSwipe\('left'/);
    assert.match(stackSrc, /playStackSound\(flipSoundEvent\(next\)\)/);
  });

  it('keyboard / a11y funnel through animateThenCommit → commit* (same sound path)', () => {
    assert.match(stackSrc, /runOnJS\(commitSwipeLeft\)/);
    assert.match(stackSrc, /runOnJS\(commitSwipeRight\)/);
    assert.match(stackSrc, /runOnJS\(commitSwipeVertical\)/);
    assert.match(stackSrc, /animateThenCommit\(action\)/);
    assert.match(stackSrc, /if \(action === 'flip'\) \{\s*toggleFlip\(\);/s);
  });

  it('emits cancel / resistance from worklets via runOnJS (not onUpdate / drag frames)', () => {
    assert.match(stackSrc, /runOnJS\(playStackSound\)\(\{ name: 'swipe_cancel' \}\)/);
    assert.match(stackSrc, /runOnJS\(playStackSound\)\(\{ name: 'swipe_resistance' \}\)/);
    assert.match(stackSrc, /shouldEmitSwipeCancel/);
    assert.match(stackSrc, /shouldEmitSwipeResistance/);
    // onUpdate must not call playStackSound / soundEvent
    const onUpdateBlocks = stackSrc.match(/\.onUpdate\([\s\S]*?\)\s*\n\s*\.onEnd/g) ?? [];
    assert.ok(onUpdateBlocks.length >= 2, 'expected panX and panY onUpdate blocks');
    for (const block of onUpdateBlocks) {
      assert.equal(/playStackSound|soundEvent/.test(block), false);
    }
  });

  it('does not play card_arrived on forward swipe commits', () => {
    assert.equal(/card_arrived|card_arrive/.test(stackSrc), false);
  });
});
