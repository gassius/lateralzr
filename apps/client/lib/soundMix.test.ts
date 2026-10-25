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
  DIRECTOR_RELATIVE_GAIN_DB,
  EFFECT_CUT_FADE_MS,
  EFFECT_MUSIC_DUCK_DB,
  EFFECT_MUSIC_DUCK_ATTACK_MS,
  EFFECT_MUSIC_DUCK_RELEASE_MS,
  EFFECT_RETRIGGER_IGNORE_MS,
  GAIN_DB_PLATFORM_OFFSET,
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
import {
  cancelActiveLateralityRowMix,
  scheduleLateralityRowMix,
} from '@/lib/lateralityMix';
import { SOUND_ASSETS, type SoundAssetName } from '@/lib/soundAssets';
import type { SoundEvent, SoundEventName } from '@/lib/soundTypes';
import {
  createSoundMusicEngine,
  MUSIC_FADE_MS,
  type MusicPlayer,
} from '@/lib/soundMusic';
import { SCREEN_READER_MUSIC_VOLUME } from '@/lib/soundPolicy';

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

test('director relative intent matches kickoff; applied table is platform-shifted ≤ 0', () => {
  assert.equal(DIRECTOR_RELATIVE_GAIN_DB['sfx-laterality-snap-1'], 2);
  assert.equal(DIRECTOR_RELATIVE_GAIN_DB['music-intro-arrival-a'], 1);
  assert.equal(DIRECTOR_RELATIVE_GAIN_DB['sfx-swipe-next-a'], 0);
  assert.equal(DIRECTOR_RELATIVE_GAIN_DB['sfx-swipe-tone-up'], -10);
  assert.equal(GAIN_DB_PLATFORM_OFFSET, -2);
  // Applied = relative + offset (loudest laterality → 0).
  assert.equal(getDirectorGainDb('sfx-laterality-snap-1'), 0);
  assert.equal(getDirectorGainDb('sfx-swipe-next-a'), -2);
  assert.equal(getDirectorGainDb('music-intro-arrival-a'), -1);
  assert.equal(getDirectorGainDb('sfx-swipe-tone-up'), -12);
  assert.equal(getDirectorGainDb('sfx-reshuffle-gather'), -4);
  assert.equal(DIRECTOR_GAIN_DB['sfx-laterality-snap-5'], 0);
  for (const name of Object.keys(DIRECTOR_GAIN_DB) as SoundAssetName[]) {
    assert.ok(DIRECTOR_GAIN_DB[name] <= 0, `${name} applied gainDb must be ≤ 0`);
  }
});

test('manifest and SOUND_ASSETS gainDb match applied director table for every asset', () => {
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

test('resolveEventGain clamps to ≤ 1 and preserves laterality > swipe relative', () => {
  const laterality = resolveEventGain(0, 'laterality_step', false);
  const swipe = resolveEventGain(-2, 'swipe_next', false);
  assert.ok(Math.abs(laterality - 1) < 1e-9);
  assert.ok(laterality > swipe);
  // Positive dB must not exceed unity on any platform.
  assert.equal(resolveEventGain(6, 'laterality_step', false), 1);
});

test('engine play volume uses module gainDb (not hardcoded 0)', () => {
  const players: ReturnType<typeof mockPlayer>[] = [];
  // Gather applied −4 dB.
  const moduleId = SOUND_ASSETS['sfx-reshuffle-gather'].module;
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

  ctrl.soundEvent({ name: 'reshuffle_started', random: false });
  assert.equal(players.length, 1);
  const expected = gainFromDb(-4);
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

test('effects duck uses duckEffects hook (not system duck)', () => {
  let t = 1000;
  const duckLog: number[] = [];
  const effectsDuckLog: { v: number; fadeMs?: number }[] = [];
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
    duck: (v) => duckLog.push(v),
    duckEffects: (v, opts) => effectsDuckLog.push({ v, fadeMs: opts?.fadeMs }),
  });

  ctrl.soundEvent({ name: 'card_flip' });
  assert.equal(duckLog.length, 0, 'effects must not call system duck()');
  assert.ok(effectsDuckLog.length >= 1);
  const ducked = effectsDuckLog.find(
    (d) => Math.abs(d.v - gainFromDb(EFFECT_MUSIC_DUCK_DB)) < 1e-6,
  );
  assert.ok(ducked, `expected effectsDuck ${gainFromDb(EFFECT_MUSIC_DUCK_DB)}`);
  assert.equal(ducked!.fadeMs, EFFECT_MUSIC_DUCK_ATTACK_MS);
  ctrl.reset();
});

test('B1: screen-reader duck survives an effect (music stays ≤ 0.08)', () => {
  let now = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;
  const setTimeoutFn = ((fn: () => void, ms?: number) => {
    const id = nextId++;
    pending.set(id, { at: now + (ms ?? 0), fn });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  const clearTimeoutFn = ((id: ReturnType<typeof setTimeout>) => {
    pending.delete(id as unknown as number);
  }) as typeof clearTimeout;
  const advance = (ms: number) => {
    const target = now + ms;
    while (true) {
      const due = [...pending.entries()]
        .filter(([, item]) => item.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) {
        now = target;
        break;
      }
      const [id, item] = due[0]!;
      now = item.at;
      pending.delete(id);
      item.fn();
    }
  };

  const players: (MusicPlayer & { volume: number })[] = [];
  const music = createSoundMusicEngine({
    createPlayer: () => {
      const p: MusicPlayer = {
        volume: 0,
        playing: false,
        loop: false,
        play() {
          p.playing = true;
        },
        pause() {
          p.playing = false;
        },
        replace() {},
        seekTo() {},
        release() {},
      };
      players.push(p);
      return p;
    },
    resolveModule: (name) => SOUND_ASSETS[name].module,
    now: () => now,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    fadeMs: MUSIC_FADE_MS,
  });

  music.handleEvent({ name: 'intro_ready' });
  music.restartBed({ fadeIn: false });
  advance(0);
  music.duck(SCREEN_READER_MUSIC_VOLUME);
  advance(MUSIC_FADE_MS);
  const bed = players.find((p) => p.playing);
  assert.ok(bed);
  assert.ok(bed!.volume <= SCREEN_READER_MUSIC_VOLUME + 1e-6);

  // Wire controller effects → music.duckEffects (the B1 surface).
  const moduleId = SOUND_ASSETS['sfx-card-flip-a'].module;
  const ctrl = createSoundController({
    createPlayer: () => mockPlayer(),
    now: () => now,
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
    duck: (v) => music.duck(v),
    duckEffects: (v, opts) => music.duckEffects(v, opts),
  });

  ctrl.soundEvent({ name: 'card_flip' });
  advance(EFFECT_MUSIC_DUCK_ATTACK_MS + 20);
  assert.ok(
    bed!.volume <= SCREEN_READER_MUSIC_VOLUME + 1e-6,
    `music rose above SR duck: ${bed!.volume}`,
  );

  // After effect release, SR duck must still hold.
  advance(2000);
  assert.ok(
    bed!.volume <= SCREEN_READER_MUSIC_VOLUME + 1e-6,
    `after effect release music=${bed!.volume}`,
  );

  ctrl.reset();
  music.reset();
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

test('B2: laterality mix timers cancel on stop / background / reset / cancelActive', () => {
  const calls: SoundEvent['name'][] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  let cleared = 0;

  scheduleLateralityRowMix({
    step: 3,
    previousStep: 1,
    random: false,
    play: (event) => {
      calls.push(event.name);
    },
    setTimeoutFn: ((fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: ((id: ReturnType<typeof setTimeout>) => {
      cleared += 1;
      timers.delete(id as unknown as number);
    }) as typeof clearTimeout,
  });
  assert.equal(calls[0], 'laterality_step');
  assert.equal(timers.size, 2);

  cancelActiveLateralityRowMix();
  assert.equal(timers.size, 0);
  assert.ok(cleared >= 2);

  // Engine stop / background / reset must also cancel an active mix.
  scheduleLateralityRowMix({
    step: 4,
    previousStep: 3,
    random: false,
    play: () => {},
    setTimeoutFn: ((fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(id as unknown as number);
    }) as typeof clearTimeout,
  });
  assert.equal(timers.size, 2);

  const ctrl = createSoundController({
    createPlayer: () => mockPlayer(),
    available: true,
    resolveEntry: () => ({
      bus: 'effects',
      variants: [SOUND_ASSETS['sfx-card-flip-a'].module],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });
  ctrl.stopAllSound();
  assert.equal(timers.size, 0, 'stopAllSound cancels laterality mix');

  scheduleLateralityRowMix({
    step: 5,
    previousStep: 4,
    random: true,
    play: () => {},
    setTimeoutFn: ((fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(id as unknown as number);
    }) as typeof clearTimeout,
  });
  ctrl.applySystemFlags({
    appActive: false,
    interrupted: false,
    screenReaderEnabled: false,
    otherAudioPlaying: false,
    announcementActive: false,
  });
  assert.equal(timers.size, 0, 'background cancels laterality mix');

  scheduleLateralityRowMix({
    step: 2,
    previousStep: 1,
    random: false,
    play: () => {},
    setTimeoutFn: ((fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeoutFn: ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(id as unknown as number);
    }) as typeof clearTimeout,
  });
  ctrl.reset();
  assert.equal(timers.size, 0, 'reset cancels laterality mix');
});

test('index cancels laterality mix on unmount', () => {
  const indexSrc = readFileSync(join(here, '../app/index.tsx'), 'utf8');
  assert.match(indexSrc, /cancelActiveLateralityRowMix/);
  assert.match(
    indexSrc,
    /useEffect\(\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{[\s\S]*?cancelActiveLateralityRowMix/,
  );
});

test('docs/audio records Sound 9 findings, platform shift, and final gain table', () => {
  const findings = readFileSync(join(here, '../../../docs/audio/sound-9-mix.md'), 'utf8');
  assert.match(findings, /Sound 9/);
  assert.match(findings, /gainDb/);
  assert.match(findings, /laterality/);
  assert.match(findings, /\+2/);
  assert.match(findings, /-10/);
  assert.match(findings, /platform|normali[sz]e|shift/i);
  assert.match(findings, /≤\s*0|<=\s*0|at most 0/i);
});
