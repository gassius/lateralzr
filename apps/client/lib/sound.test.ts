import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SOUND_ASSETS } from '@/lib/soundAssets';
import { getSoundMapEntry, playableVariants, SOUND_MAP, type SoundMapEntry } from '@/lib/soundMap';
import {
  createEffectsPool,
  createSoundController,
  EFFECTS_POOL_SIZE,
  isBusEnabled,
  pickVariantIndex,
  resolveLadderSource,
  resolveReshuffleLandSource,
  type SoundPlayer,
} from '@/lib/soundEngine';
import {
  DEFAULT_SOUND_PREFERENCES,
  type SoundEventName,
} from '@/lib/soundTypes';

function mockPlayer(overrides: Partial<SoundPlayer> = {}): SoundPlayer & {
  calls: { play: number; pause: number; replace: unknown[]; seekTo: number[]; release: number };
} {
  const calls = {
    play: 0,
    pause: 0,
    replace: [] as unknown[],
    seekTo: [] as number[],
    release: 0,
  };
  const player: SoundPlayer & { calls: typeof calls } = {
    calls,
    volume: 1,
    playing: false,
    play() {
      calls.play += 1;
      player.playing = true;
    },
    pause() {
      calls.pause += 1;
      player.playing = false;
    },
    replace(source) {
      calls.replace.push(source);
    },
    seekTo(seconds) {
      calls.seekTo.push(seconds);
    },
    release() {
      calls.release += 1;
    },
    ...overrides,
  };
  return player;
}

function entryWithVariants(
  name: SoundEventName,
  variants: number[],
  patch: Partial<SoundMapEntry> = {},
): (n: SoundEventName) => SoundMapEntry {
  const base = getSoundMapEntry(name);
  const overridden: SoundMapEntry = { ...base, variants, ...patch };
  return (n) => (n === name ? overridden : getSoundMapEntry(n));
}

test('SOUND_MAP covers every SoundEvent name', () => {
  const names: SoundEventName[] = [
    'card_flip',
    'card_flip_back',
    'swipe_next',
    'swipe_back',
    'swipe_cancel',
    'swipe_resistance',
    'complexity_changed',
    'laterality_step',
    'reshuffle_started',
    'reshuffle_landed',
    'card_arrived',
    'sheet_open',
    'sheet_close',
    'error_soft',
    'no_match',
    'intro_started',
    'intro_ready',
  ];
  for (const name of names) {
    assert.ok(SOUND_MAP[name], `missing map entry for ${name}`);
    assert.ok(Array.isArray(SOUND_MAP[name].variants));
  }
  assert.equal(Object.keys(SOUND_MAP).length, names.length);
});

test('every Sound 1 map event has at least one playable asset (Sound 3)', () => {
  for (const name of Object.keys(SOUND_MAP) as SoundEventName[]) {
    const playable = playableVariants(SOUND_MAP[name]);
    assert.ok(
      playable.length >= 1,
      `Sound 3: expected ≥1 asset for event ${name}`,
    );
  }
});

test('playableVariants drops null placeholders', () => {
  assert.deepEqual(
    playableVariants({
      bus: 'effects',
      variants: [null, 11, null, 22],
      minIntervalMs: 0,
      maxVoices: 1,
    }),
    [11, 22],
  );
});

test('pickVariantIndex never returns the same index twice when count > 1', () => {
  const sequence: number[] = [];
  let last: number | null = null;
  for (let i = 0; i < 20; i++) {
    const next = pickVariantIndex(3, last, () => 0);
    assert.notEqual(next, null);
    if (last != null) assert.notEqual(next, last);
    sequence.push(next!);
    last = next;
  }
  assert.equal(sequence[0], 0);
  assert.equal(sequence[1], 1);
  assert.equal(sequence[2], 0);
});

test('pickVariantIndex handles count 0 and 1', () => {
  assert.equal(pickVariantIndex(0, null), null);
  assert.equal(pickVariantIndex(1, 0), 0);
  assert.equal(pickVariantIndex(1, null), 0);
});

test('effects pool creates up to pool size then reuses oldest', () => {
  const created: ReturnType<typeof mockPlayer>[] = [];
  const pool = createEffectsPool({
    createPlayer: (source) => {
      const p = mockPlayer();
      p.replace(source);
      created.push(p);
      return p;
    },
    poolSize: 3,
    now: (() => {
      let t = 0;
      return () => {
        t += 1;
        return t;
      };
    })(),
  });

  const a = pool.acquire(1, 'card_flip') as ReturnType<typeof mockPlayer>;
  a.play();
  const b = pool.acquire(2, 'card_flip');
  b.play();
  const c = pool.acquire(3, 'card_flip');
  c.play();
  assert.equal(pool.size(), 3);
  assert.equal(created.length, 3);

  const d = pool.acquire(99, 'swipe_next');
  assert.equal(pool.size(), 3);
  assert.equal(created.length, 3);
  assert.equal(d, a);
  assert.ok(a.calls.replace.includes(99));
});

test('effects pool prefers idle slot over eviction', () => {
  const pool = createEffectsPool({
    createPlayer: () => mockPlayer(),
    poolSize: 2,
  });
  const first = pool.acquire(1, 'card_flip');
  first.play();
  first.pause();
  const second = pool.acquire(2, 'swipe_next');
  assert.equal(second, first);
  assert.equal(pool.size(), 1);
});

test('rate limit skips plays inside minIntervalMs', () => {
  let t = 1000;
  const players: ReturnType<typeof mockPlayer>[] = [];
  const minIntervalMs = 50;
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    now: () => t,
    random: () => 0,
    available: true,
    resolveEntry: entryWithVariants('card_flip', [101], { minIntervalMs, maxVoices: 4 }),
  });

  ctrl.soundEvent({ name: 'card_flip' });
  ctrl.soundEvent({ name: 'card_flip' });
  assert.equal(players.length, 1);
  assert.equal(players[0]!.calls.play, 1);

  t += minIntervalMs;
  ctrl.soundEvent({ name: 'card_flip' });
  assert.ok(players.reduce((n, p) => n + p.calls.play, 0) >= 2);
  ctrl.reset();
});

test('voice cap skips when max concurrent voices reached', () => {
  let t = 0;
  const players: ReturnType<typeof mockPlayer>[] = [];
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    now: () => {
      t += 1000;
      return t;
    },
    random: () => 0,
    resolveEntry: entryWithVariants('swipe_cancel', [7], { minIntervalMs: 0, maxVoices: 1 }),
  });

  ctrl.soundEvent({ name: 'swipe_cancel' });
  assert.equal(players.length, 1);
  assert.equal(players[0]!.playing, true);

  ctrl.soundEvent({ name: 'swipe_cancel' });
  assert.equal(players.length, 1);
  assert.equal(players[0]!.calls.play, 1);
  ctrl.reset();
});

test('disabled master / effects bus makes no player calls', () => {
  let createCount = 0;
  const ctrl = createSoundController({
    createPlayer: () => {
      createCount += 1;
      return mockPlayer();
    },
    resolveEntry: entryWithVariants('card_arrived', [55]),
  });

  ctrl.setSoundPreferences({ sound: false, music: true, effects: true });
  ctrl.soundEvent({ name: 'card_arrived' });
  assert.equal(createCount, 0);

  ctrl.setSoundPreferences({ sound: true, music: true, effects: false });
  ctrl.soundEvent({ name: 'card_arrived' });
  assert.equal(createCount, 0);

  ctrl.setSoundPreferences(DEFAULT_SOUND_PREFERENCES);
  ctrl.soundEvent({ name: 'card_arrived' });
  assert.equal(createCount, 1);
  ctrl.reset();
});

test('empty variant list is a no-op (missing assets)', () => {
  let createCount = 0;
  const ctrl = createSoundController({
    createPlayer: () => {
      createCount += 1;
      return mockPlayer();
    },
    resolveEntry: entryWithVariants('card_flip', []),
  });
  ctrl.soundEvent({ name: 'card_flip' });
  assert.equal(createCount, 0);
});

test('isBusEnabled respects master and per-bus flags', () => {
  assert.equal(isBusEnabled({ sound: false, music: true, effects: true }, 'effects'), false);
  assert.equal(isBusEnabled({ sound: true, music: false, effects: true }, 'music'), false);
  assert.equal(isBusEnabled({ sound: true, music: true, effects: false }, 'effects'), false);
  assert.equal(isBusEnabled(DEFAULT_SOUND_PREFERENCES, 'effects'), true);
});

test('EFFECTS_POOL_SIZE is ~6', () => {
  assert.equal(EFFECTS_POOL_SIZE, 6);
});

test('music off fades music players instead of hard-cutting only effects', () => {
  const musicPlayer = mockPlayer();
  musicPlayer.playing = true;
  musicPlayer.volume = 1;
  let created = 0;
  const ctrl = createSoundController({
    createPlayer: () => {
      created += 1;
      return musicPlayer;
    },
    resolveEntry: entryWithVariants('intro_started', [9], {
      bus: 'music',
      minIntervalMs: 0,
      maxVoices: 1,
    }),
  });

  ctrl.soundEvent({ name: 'intro_started' });
  assert.equal(created, 1);
  assert.equal(musicPlayer.volume, 1);

  ctrl.setSoundPreferences({ sound: true, music: false, effects: true });
  assert.equal(musicPlayer.volume, 0);
  assert.equal(musicPlayer.calls.pause, 1);
  ctrl.reset();
});

test('web stub API is safe no-op and unavailable', async () => {
  const web = await import('@/lib/sound.web.ts');
  assert.equal(web.isSoundAvailable(), false);
  assert.doesNotThrow(() => web.soundEvent({ name: 'card_flip' }));
  assert.doesNotThrow(() =>
    web.setSoundPreferences({ sound: false, music: false, effects: false }),
  );
  assert.equal(web.canStartMusic(), false);
  assert.doesNotThrow(() => web.registerSoundMusicHooks(null));
  assert.doesNotThrow(() => web.beginSoundAnnouncement());
  assert.doesNotThrow(() => web.endSoundAnnouncement());
  assert.doesNotThrow(() => web.notifySoundInterruption(true));
});

test('pause/resume/duck hooks are callable before Sound 6 registers players', () => {
  const ctrl = createSoundController({
    createPlayer: () => mockPlayer(),
    resolveEntry: entryWithVariants('card_flip', [1]),
  });
  assert.doesNotThrow(() => ctrl.pauseMusic());
  assert.doesNotThrow(() => ctrl.resumeMusic({ fadeIn: true }));
  assert.doesNotThrow(() => ctrl.duckMusic(0.1));
  assert.equal(ctrl.canStartMusic(), true);
  ctrl.applySystemFlags({
    appActive: true,
    interrupted: false,
    screenReaderEnabled: false,
    otherAudioPlaying: true,
    announcementActive: false,
  });
  assert.equal(ctrl.canStartMusic(), false);
  ctrl.reset();
});

test('pauseMusic pauses music bus only, not effects (M3)', () => {
  const musicPlayer = mockPlayer();
  const effectsPlayer = mockPlayer();
  musicPlayer.playing = true;
  effectsPlayer.playing = true;
  let n = 0;
  const ctrl = createSoundController({
    createPlayer: () => {
      n += 1;
      return n === 1 ? musicPlayer : effectsPlayer;
    },
    resolveEntry: (name) =>
      name === 'intro_started'
        ? { bus: 'music', variants: [9], minIntervalMs: 0, maxVoices: 1 }
        : { bus: 'effects', variants: [8], minIntervalMs: 0, maxVoices: 2 },
  });

  ctrl.soundEvent({ name: 'intro_started' });
  ctrl.soundEvent({ name: 'card_flip' });
  assert.equal(musicPlayer.calls.play, 1);
  assert.equal(effectsPlayer.calls.play, 1);

  ctrl.pauseMusic();
  assert.equal(musicPlayer.calls.pause, 1);
  assert.equal(effectsPlayer.calls.pause, 0);
  assert.equal(effectsPlayer.playing, true);
  ctrl.reset();
});

test('complexity_changed picks the ladder asset for the event level', () => {
  assert.equal(
    resolveLadderSource({ name: 'complexity_changed', level: 3 }),
    SOUND_ASSETS['sfx-complexity-3'].module,
  );
  assert.equal(
    resolveLadderSource({ name: 'complexity_changed', level: 1 }),
    SOUND_ASSETS['sfx-complexity-1'].module,
  );
});

test('laterality_step picks the D-Dorian octave-6 ladder asset', () => {
  assert.equal(
    resolveLadderSource({ name: 'laterality_step', step: 5 }),
    SOUND_ASSETS['sfx-laterality-snap-5'].module,
  );
  assert.equal(
    resolveLadderSource({ name: 'laterality_step', step: 1 }),
    SOUND_ASSETS['sfx-laterality-snap-1'].module,
  );
});

test('reshuffle_landed random picks wide land; otherwise a/b variants', () => {
  assert.equal(
    resolveReshuffleLandSource({ name: 'reshuffle_landed', random: true }),
    SOUND_ASSETS['sfx-reshuffle-land-wide'].module,
  );
  assert.equal(
    resolveReshuffleLandSource({ name: 'reshuffle_landed', random: false }),
    null,
  );

  const sources: unknown[] = [];
  let t = 0;
  const ctrl = createSoundController({
    createPlayer: (source) => {
      sources.push(source);
      return mockPlayer();
    },
    now: () => {
      t += 200;
      return t;
    },
    random: () => 0,
  });
  ctrl.soundEvent({ name: 'reshuffle_landed', random: true });
  assert.equal(sources[0], SOUND_ASSETS['sfx-reshuffle-land-wide'].module);
  ctrl.reset();
});

test('reduced motion lowers motion-tied SFX volume by ~3 dB', () => {
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
    resolveEntry: entryWithVariants('swipe_next', [42], { minIntervalMs: 0, maxVoices: 4 }),
  });

  ctrl.soundEvent({ name: 'swipe_next' });
  assert.equal(players[0]!.volume, 1);
  players[0]!.playing = false;

  ctrl.soundEvent({ name: 'swipe_next' }, { reduceMotion: true });
  const expected = Math.pow(10, -3 / 20);
  assert.ok(Math.abs(players[0]!.volume - expected) < 1e-9);
  ctrl.reset();
});
