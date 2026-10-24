/**
 * Sound 9 — mix / gainDb / concurrent effects / laterality stagger.
 * These assert new behaviour; they must fail on the pre-Sound-9 engine.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AUDIO_MANIFEST,
  getAudioManifestAsset,
} from '@/lib/audioManifest';
import {
  DIRECTOR_GAIN_DB,
  EFFECT_CUT_FADE_MS,
  EFFECT_MUSIC_DUCK_DB,
  EFFECT_MUSIC_DUCK_ATTACK_MS,
  EFFECT_MUSIC_DUCK_RELEASE_MS,
  EFFECT_RETRIGGER_IGNORE_MS,
  LATERALITY_GATHER_DELAY_MS,
  LATERALITY_SHEET_CLOSE_ATTENUATION_DB,
  LATERALITY_SHEET_CLOSE_DELAY_MS,
  MAX_CONCURRENT_EFFECTS,
  MEANING_CARRYING_EFFECTS,
  gainFromDb,
  getDirectorGainDb,
  resolveEventGain,
} from '@/lib/soundMap';
import {
  createSoundController,
  type SoundPlayer,
} from '@/lib/soundEngine';
import { scheduleLateralityRowMix } from '@/lib/lateralityMix';
import { SOUND_ASSETS, type SoundAssetName } from '@/lib/soundAssets';
import type { SoundEvent, SoundEventName } from '@/lib/soundTypes';
import { DEFAULT_SOUND_PREFERENCES } from '@/lib/soundTypes';

const here = dirname(fileURLToPath(import.meta.url));

function mockPlayer(): SoundPlayer & {
  calls: { play: number; pause: number; release: number };
  volumes: number[];
} {
  const calls = { play: 0, pause: 0, release: 0 };
  const volumes: number[] = [];
  let volume = 1;
  const player: SoundPlayer & { calls: typeof calls; volumes: number[] } = {
    calls,
    volumes,
    playing: false,
    get volume() {
      return volume;
    },
    set volume(v: number) {
      volume = v;
      volumes.push(v);
    },
    play() {
      calls.play += 1;
      player.playing = true;
    },
    pause() {
      calls.pause += 1;
      player.playing = false;
    },
    replace() {},
    seekTo() {},
    release() {
      calls.release += 1;
    },
  };
  return player;
}

afterEach(() => {
  // Controllers are reset in each test.
});

test('director gain table matches kickoff starting levels', () => {
  assert.equal(getDirectorGainDb('sfx-swipe-next-a'), 0);
  assert.equal(getDirectorGainDb('sfx-card-flip-a'), 0);
  assert.equal(getDirectorGainDb('sfx-swipe-cancel-a'), 0);
  assert.equal(getDirectorGainDb('sfx-swipe-resistance-a'), 0);
  assert.equal(getDirectorGainDb('sfx-sheet-close'), 0);
  assert.equal(getDirectorGainDb('sfx-error-soft-a'), 0);
  assert.equal(getDirectorGainDb('sfx-no-match-soft'), 0);
  assert.equal(getDirectorGainDb('sfx-complexity-3'), 0);
  assert.equal(getDirectorGainDb('sfx-laterality-snap-1'), 2);
  assert.equal(getDirectorGainDb('sfx-swipe-tone-up'), -10);
  assert.equal(getDirectorGainDb('sfx-reshuffle-gather'), -2);
  assert.equal(getDirectorGainDb('sfx-reshuffle-land-a'), 0);
  assert.equal(getDirectorGainDb('sfx-card-arrive-a'), -2);
  assert.equal(getDirectorGainDb('music-bed-calm-a'), 0);
  assert.equal(getDirectorGainDb('music-texture-shimmer-a'), -4);
  assert.equal(getDirectorGainDb('music-dropin-01'), -3);
  assert.equal(getDirectorGainDb('music-intro-loop'), 0);
  assert.equal(getDirectorGainDb('music-intro-arrival-a'), 1);
  assert.equal(DIRECTOR_GAIN_DB['sfx-laterality-snap-5'], 2);
});

test('manifest and SOUND_ASSETS gainDb match director table for every asset', () => {
  for (const name of Object.keys(SOUND_ASSETS) as SoundAssetName[]) {
    const expected = getDirectorGainDb(name);
    assert.equal(
      SOUND_ASSETS[name].gainDb,
      expected,
      `SOUND_ASSETS ${name} gainDb`,
    );
    const man = getAudioManifestAsset(name);
    assert.ok(man, `manifest ${name}`);
    assert.equal(man!.gainDb, expected, `manifest ${name} gainDb`);
  }
  assert.equal(Object.keys(AUDIO_MANIFEST.assets).length, 68);
});

test('resolveEventGain applies asset gainDb (laterality +2 → louder than unity)', () => {
  const unity = resolveEventGain(0, 'laterality_step', false);
  const boosted = resolveEventGain(2, 'laterality_step', false);
  assert.ok(Math.abs(unity - 1) < 1e-9);
  assert.ok(Math.abs(boosted - gainFromDb(2)) < 1e-9);
  assert.ok(boosted > unity);
});

test('engine play volume uses module gainDb (not hardcoded 0)', () => {
  const players: ReturnType<typeof mockPlayer>[] = [];
  // Use laterality snap module (+2 dB in table).
  const moduleId = SOUND_ASSETS['sfx-laterality-snap-3'].module;
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    now: () => 1000,
    random: () => 0,
    available: true,
    resolveEntry: () => ({
      bus: 'effects',
      variants: [moduleId],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });

  ctrl.soundEvent({ name: 'laterality_step', step: 3 });
  assert.equal(players.length, 1);
  const expected = gainFromDb(2);
  assert.ok(
    Math.abs(players[0]!.volume - expected) < 1e-6,
    `expected ~${expected}, got ${players[0]!.volume}`,
  );
  ctrl.reset();
});

test('mix policy constants match director', () => {
  assert.equal(MAX_CONCURRENT_EFFECTS, 2);
  assert.equal(EFFECT_CUT_FADE_MS, 30);
  assert.equal(EFFECT_RETRIGGER_IGNORE_MS, 60);
  assert.equal(EFFECT_MUSIC_DUCK_DB, -3);
  assert.equal(EFFECT_MUSIC_DUCK_ATTACK_MS, 50);
  assert.equal(EFFECT_MUSIC_DUCK_RELEASE_MS, 400);
  assert.equal(LATERALITY_SHEET_CLOSE_DELAY_MS, 80);
  assert.equal(LATERALITY_GATHER_DELAY_MS, 250);
  assert.equal(LATERALITY_SHEET_CLOSE_ATTENUATION_DB, -3);
  assert.ok(MEANING_CARRYING_EFFECTS.has('laterality_step'));
  assert.ok(MEANING_CARRYING_EFFECTS.has('error_soft'));
});

test('same effect retrigger within 60 ms is ignored', () => {
  let t = 1000;
  const players: ReturnType<typeof mockPlayer>[] = [];
  const moduleId = SOUND_ASSETS['sfx-swipe-next-a'].module;
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    now: () => t,
    random: () => 0,
    available: true,
    resolveEntry: () => ({
      bus: 'effects',
      variants: [moduleId],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });

  ctrl.soundEvent({ name: 'swipe_next' });
  t += 30;
  ctrl.soundEvent({ name: 'swipe_next' });
  assert.equal(players.reduce((n, p) => n + p.calls.play, 0), 1);

  t += EFFECT_RETRIGGER_IGNORE_MS;
  ctrl.soundEvent({ name: 'swipe_next' });
  assert.ok(players.reduce((n, p) => n + p.calls.play, 0) >= 2);
  ctrl.reset();
});

test('max 2 concurrent effects: third cuts oldest non-meaning with fade', () => {
  let t = 0;
  const players: ReturnType<typeof mockPlayer>[] = [];
  const duckLog: number[] = [];
  const ids = {
    flip: SOUND_ASSETS['sfx-card-flip-a'].module,
    swipe: SOUND_ASSETS['sfx-swipe-next-a'].module,
    arrive: SOUND_ASSETS['sfx-card-arrive-a'].module,
  };
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    now: () => {
      t += 100;
      return t;
    },
    random: () => 0,
    available: true,
    resolveEntry: (name: SoundEventName) => ({
      bus: 'effects' as const,
      variants:
        name === 'card_flip'
          ? [ids.flip]
          : name === 'swipe_next'
            ? [ids.swipe]
            : [ids.arrive],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });
  ctrl.registerMusicHooks({
    duck: (v) => duckLog.push(v),
  });

  ctrl.soundEvent({ name: 'card_flip' });
  ctrl.soundEvent({ name: 'swipe_next' });
  assert.equal(players.filter((p) => p.playing).length, 2);

  const oldest = players[0]!;
  const oldestVol = oldest.volume;
  ctrl.soundEvent({ name: 'card_arrived' });

  // Oldest should be fading / stopped; at most 2 still playing after cut settles.
  assert.ok(oldest.volume < oldestVol || !oldest.playing);
  assert.ok(players.length >= 3);
  ctrl.reset();
});

test('max 2 never cuts laterality_step or error_soft', () => {
  let t = 0;
  const players: ReturnType<typeof mockPlayer>[] = [];
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    now: () => {
      t += 100;
      return t;
    },
    random: () => 0,
    available: true,
    resolveEntry: (name: SoundEventName) => ({
      bus: 'effects' as const,
      variants: [
        name === 'laterality_step'
          ? SOUND_ASSETS['sfx-laterality-snap-1'].module
          : name === 'error_soft'
            ? SOUND_ASSETS['sfx-error-soft-a'].module
            : SOUND_ASSETS['sfx-swipe-next-a'].module,
      ],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });

  ctrl.soundEvent({ name: 'laterality_step', step: 1 });
  ctrl.soundEvent({ name: 'error_soft' });
  assert.equal(players.filter((p) => p.playing).length, 2);
  const stepPlayer = players[0]!;
  const errorPlayer = players[1]!;
  const stepVol = stepPlayer.volume;
  const errorVol = errorPlayer.volume;

  ctrl.soundEvent({ name: 'swipe_next' });
  // Meaning-carrying still playing at full-ish level (not faded out).
  assert.equal(stepPlayer.playing, true);
  assert.equal(errorPlayer.playing, true);
  assert.ok(Math.abs(stepPlayer.volume - stepVol) < 1e-6);
  assert.ok(Math.abs(errorPlayer.volume - errorVol) < 1e-6);
  ctrl.reset();
});

test('effects duck music by -3 dB while playing', () => {
  let t = 1000;
  const duckLog: { at: number; v: number }[] = [];
  const moduleId = SOUND_ASSETS['sfx-card-flip-a'].module;
  const ctrl = createSoundController({
    createPlayer: () => mockPlayer(),
    now: () => t,
    random: () => 0,
    available: true,
    resolveEntry: () => ({
      bus: 'effects',
      variants: [moduleId],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });
  ctrl.registerMusicHooks({
    duck: (v) => duckLog.push({ at: t, v }),
  });

  ctrl.soundEvent({ name: 'card_flip' });
  assert.ok(duckLog.length >= 1);
  const ducked = duckLog.find((d) => Math.abs(d.v - gainFromDb(EFFECT_MUSIC_DUCK_DB)) < 1e-6);
  assert.ok(ducked, `expected duck ${gainFromDb(EFFECT_MUSIC_DUCK_DB)}, got ${JSON.stringify(duckLog)}`);
  ctrl.reset();
});

test('laterality row mix staggers step → sheet_close −3 dB → gather', () => {
  const calls: { event: SoundEvent; options?: { gainDbOffset?: number }; at: number }[] = [];
  let t = 0;
  const timers: { fn: () => void; ms: number }[] = [];

  const handle = scheduleLateralityRowMix({
    step: 4,
    random: false,
    play: (event, options) => {
      calls.push({ event, options, at: t });
    },
    now: () => t,
    setTimeoutFn: ((fn: () => void, ms: number) => {
      timers.push({ fn, ms });
      return timers.length as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: (() => {}) as typeof clearTimeout,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.event, { name: 'laterality_step', step: 4 });

  // Advance to sheet_close.
  const sheetTimer = timers.find((x) => x.ms === LATERALITY_SHEET_CLOSE_DELAY_MS);
  assert.ok(sheetTimer);
  t = LATERALITY_SHEET_CLOSE_DELAY_MS;
  sheetTimer!.fn();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1]!.event, { name: 'sheet_close' });
  assert.equal(calls[1]!.options?.gainDbOffset, LATERALITY_SHEET_CLOSE_ATTENUATION_DB);

  const gatherTimer = timers.find((x) => x.ms === LATERALITY_GATHER_DELAY_MS);
  assert.ok(gatherTimer);
  t = LATERALITY_GATHER_DELAY_MS;
  gatherTimer!.fn();
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2]!.event, { name: 'reshuffle_started', random: false });

  handle.cancel();
});

test('docs/audio records Sound 9 findings and final gain table', () => {
  const findings = readFileSync(join(here, '../../../docs/audio/sound-9-mix.md'), 'utf8');
  assert.match(findings, /Sound 9/);
  assert.match(findings, /gainDb/);
  assert.match(findings, /laterality/);
  assert.match(findings, /\+2/);
  assert.match(findings, /-10/);
});
