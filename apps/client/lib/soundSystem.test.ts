import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { DEFAULT_SOUND_PREFERENCES } from '@/lib/soundTypes';
import { runAccessibilityAnnounce } from '@/lib/soundAnnounce';
import {
  applyMusicLifecycleTransition,
  bindSoundSystem,
  DEFAULT_SOUND_SYSTEM_FLAGS,
  isAppStateActive,
  isAppStateBackground,
  NOOP_MUSIC_HOOKS,
  resolvePlaybackGates,
  shouldPlaySoundEvent,
  type SoundMusicLifecycleHooks,
  type SoundSystemFlags,
} from '@/lib/soundSystem';
import { createSoundController, type SoundPlayer } from '@/lib/soundEngine';
import { SCREEN_READER_MUSIC_VOLUME } from '@/lib/soundPolicy';

function mockPlayer(): SoundPlayer & {
  calls: { play: number; pause: number; release: number };
} {
  const calls = { play: 0, pause: 0, release: 0 };
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
    replace() {},
    seekTo() {},
    release() {
      calls.release += 1;
    },
  };
  return player;
}

function recordingHooks(): SoundMusicLifecycleHooks & {
  log: string[];
} {
  const log: string[] = [];
  return {
    log,
    pause: () => log.push('pause'),
    resume: (opts) => log.push(`resume:${opts.fadeIn ? 'fade' : 'hard'}`),
    duck: (v) => log.push(`duck:${v}`),
    duckEffects: (v) => log.push(`duckEffects:${v}`),
    pauseDropIns: () => log.push('pauseDropIns'),
    resumeDropIns: () => log.push('resumeDropIns'),
    stop: () => log.push('stop'),
    restartBed: (opts) => log.push(`restartBed:${opts.fadeIn ? 'fade' : 'hard'}`),
  };
}

test('isAppStateActive treats only active as foreground', () => {
  assert.equal(isAppStateActive('active'), true);
  assert.equal(isAppStateActive('background'), false);
  assert.equal(isAppStateActive('inactive'), false);
});

test('isAppStateBackground is true only for background (not inactive)', () => {
  assert.equal(isAppStateBackground('background'), true);
  assert.equal(isAppStateBackground('inactive'), false);
  assert.equal(isAppStateBackground('active'), false);
});

test('resolvePlaybackGates skips music when other audio is playing', () => {
  const gates = resolvePlaybackGates(DEFAULT_SOUND_PREFERENCES, {
    ...DEFAULT_SOUND_SYSTEM_FLAGS,
    otherAudioPlaying: true,
  });
  assert.equal(gates.allowMusicStart, false);
  assert.equal(gates.allowEffects, true);
});

test('resolvePlaybackGates ducks music and mutes effects under screen reader', () => {
  const gates = resolvePlaybackGates(DEFAULT_SOUND_PREFERENCES, {
    ...DEFAULT_SOUND_SYSTEM_FLAGS,
    screenReaderEnabled: true,
  });
  assert.equal(gates.allowEffects, false);
  assert.equal(gates.effectsVolume, 0);
  assert.equal(gates.musicVolume, SCREEN_READER_MUSIC_VOLUME);
  assert.equal(gates.dropInsPaused, true);
  assert.equal(gates.suppressReshuffleEffects, true);
});

test('shouldPlaySoundEvent suppresses reshuffle around announcements', () => {
  const gates = resolvePlaybackGates(DEFAULT_SOUND_PREFERENCES, {
    ...DEFAULT_SOUND_SYSTEM_FLAGS,
    announcementActive: true,
  });
  assert.equal(shouldPlaySoundEvent('reshuffle_started', 'effects', gates), false);
  assert.equal(shouldPlaySoundEvent('reshuffle_landed', 'effects', gates), false);
  assert.equal(shouldPlaySoundEvent('card_flip', 'effects', gates), false);
});

test('background transition stops music hooks; foreground restarts bed with fade', () => {
  const hooks = recordingHooks();
  const prev = { ...DEFAULT_SOUND_SYSTEM_FLAGS, appActive: true };
  const next = { ...DEFAULT_SOUND_SYSTEM_FLAGS, appActive: false };
  applyMusicLifecycleTransition(hooks, DEFAULT_SOUND_PREFERENCES, next, prev);
  assert.deepEqual(hooks.log, ['stop', 'pauseDropIns']);

  hooks.log.length = 0;
  applyMusicLifecycleTransition(hooks, DEFAULT_SOUND_PREFERENCES, prev, next);
  assert.ok(hooks.log.includes('restartBed:fade'));
});

test('interruption pauses music and resumes with fade-in when clear', () => {
  const hooks = recordingHooks();
  applyMusicLifecycleTransition(
    hooks,
    DEFAULT_SOUND_PREFERENCES,
    { ...DEFAULT_SOUND_SYSTEM_FLAGS, interrupted: true },
    DEFAULT_SOUND_SYSTEM_FLAGS,
  );
  assert.deepEqual(hooks.log, ['pause', 'pauseDropIns']);

  hooks.log.length = 0;
  applyMusicLifecycleTransition(
    hooks,
    DEFAULT_SOUND_PREFERENCES,
    DEFAULT_SOUND_SYSTEM_FLAGS,
    { ...DEFAULT_SOUND_SYSTEM_FLAGS, interrupted: true },
  );
  assert.ok(hooks.log.includes('resume:fade'));
});

test('bindSoundSystem wires mocked AppState + AccessibilityInfo', async () => {
  const flagsRef: { current: SoundSystemFlags } = {
    current: { ...DEFAULT_SOUND_SYSTEM_FLAGS },
  };
  const listeners: {
    app: ((s: string) => void) | null;
    a11y: ((e: boolean) => void) | null;
  } = { app: null, a11y: null };
  let appState: string = 'active';
  let screenReader = false;
  const audioActiveCalls: boolean[] = [];

  const binding = bindSoundSystem(
    {
      getFlags: () => ({ ...flagsRef.current }),
      applyFlags: (next) => {
        flagsRef.current = { ...next };
      },
    },
    {
      getAppState: () => appState,
      subscribeAppState: (listener) => {
        listeners.app = listener;
        return {
          remove: () => {
            listeners.app = null;
          },
        };
      },
      isScreenReaderEnabled: async () => screenReader,
      subscribeScreenReader: (listener) => {
        listeners.a11y = listener;
        return {
          remove: () => {
            listeners.a11y = null;
          },
        };
      },
      setAudioActive: (active) => {
        audioActiveCalls.push(active);
      },
      announcementSuppressMs: 20,
    },
  );

  // Let initial screen-reader promise settle.
  await Promise.resolve();
  await Promise.resolve();

  assert.ok(listeners.app);
  assert.ok(listeners.a11y);

  appState = 'background';
  listeners.app('background');
  assert.equal(flagsRef.current.appActive, false);
  assert.deepEqual(audioActiveCalls.at(-1), false);

  listeners.app('active');
  assert.equal(flagsRef.current.appActive, true);
  assert.deepEqual(audioActiveCalls.at(-1), true);

  listeners.a11y(true);
  assert.equal(flagsRef.current.screenReaderEnabled, true);

  // M1: iOS inactive must not stop audio / flip appActive.
  const beforeInactive = { ...flagsRef.current };
  listeners.app('inactive');
  assert.equal(flagsRef.current.appActive, beforeInactive.appActive);
  assert.equal(flagsRef.current.appActive, true);
  assert.equal(audioActiveCalls.at(-1), true);

  binding.notifyInterruption(true);
  assert.equal(flagsRef.current.interrupted, true);
  binding.notifyInterruption(false);
  assert.equal(flagsRef.current.interrupted, false);

  binding.beginAnnouncement();
  assert.equal(flagsRef.current.announcementActive, true);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(flagsRef.current.announcementActive, false);

  binding.dispose();
  assert.equal(listeners.app, null);
  assert.equal(listeners.a11y, null);
});

test('screen reader off restores music level via duck(1) (M2)', () => {
  const hooks = recordingHooks();
  applyMusicLifecycleTransition(
    hooks,
    DEFAULT_SOUND_PREFERENCES,
    { ...DEFAULT_SOUND_SYSTEM_FLAGS, screenReaderEnabled: true },
    DEFAULT_SOUND_SYSTEM_FLAGS,
  );
  assert.ok(hooks.log.includes(`duck:${SCREEN_READER_MUSIC_VOLUME}`));

  hooks.log.length = 0;
  applyMusicLifecycleTransition(
    hooks,
    DEFAULT_SOUND_PREFERENCES,
    DEFAULT_SOUND_SYSTEM_FLAGS,
    { ...DEFAULT_SOUND_SYSTEM_FLAGS, screenReaderEnabled: true },
  );
  assert.ok(hooks.log.includes('duck:1'));
  assert.ok(hooks.log.includes('resume:fade'));
});

test('runAccessibilityAnnounce wraps begin/announce/end (M4)', () => {
  const log: string[] = [];
  const dispose = runAccessibilityAnnounce('Loading a new neighborhood', {
    begin: () => log.push('begin'),
    announce: (msg) => log.push(`announce:${msg}`),
    end: () => log.push('end'),
  });
  assert.deepEqual(log, ['begin', 'announce:Loading a new neighborhood']);
  dispose();
  assert.deepEqual(log, ['begin', 'announce:Loading a new neighborhood', 'end']);
});

test('controller stops effects on background and gates music on other audio', () => {
  const players: ReturnType<typeof mockPlayer>[] = [];
  const hooks = recordingHooks();
  const ctrl = createSoundController({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    resolveEntry: (name) => ({
      bus: name.startsWith('intro') ? 'music' : 'effects',
      variants: [1],
      minIntervalMs: 0,
      maxVoices: 4,
    }),
  });
  ctrl.registerMusicHooks(hooks);

  ctrl.soundEvent({ name: 'card_flip' });
  assert.equal(players.length, 1);
  assert.equal(players[0]!.calls.play, 1);

  ctrl.applySystemFlags({ ...DEFAULT_SOUND_SYSTEM_FLAGS, appActive: false });
  assert.ok(hooks.log.includes('stop'));
  assert.equal(ctrl.getPoolSize(), 0);

  ctrl.applySystemFlags({ ...DEFAULT_SOUND_SYSTEM_FLAGS, appActive: true });
  assert.ok(hooks.log.includes('restartBed:fade'));

  hooks.log.length = 0;
  ctrl.applySystemFlags({
    ...DEFAULT_SOUND_SYSTEM_FLAGS,
    otherAudioPlaying: true,
  });
  assert.equal(ctrl.canStartMusic(), false);
  ctrl.soundEvent({ name: 'intro_started' });
  // No new music player while other audio is playing.
  assert.equal(
    players.filter((p) => p.calls.play > 0).length,
    1,
  );

  ctrl.applySystemFlags({
    ...DEFAULT_SOUND_SYSTEM_FLAGS,
    screenReaderEnabled: true,
  });
  const before = players.length;
  ctrl.soundEvent({ name: 'reshuffle_started', random: false });
  ctrl.soundEvent({ name: 'card_flip' });
  assert.equal(players.length, before);
  assert.ok(hooks.log.includes(`duck:${SCREEN_READER_MUSIC_VOLUME}`));

  ctrl.reset();
});

test('noop music hooks are safe defaults', () => {
  assert.doesNotThrow(() => {
    NOOP_MUSIC_HOOKS.pause();
    NOOP_MUSIC_HOOKS.resume({ fadeIn: true });
    NOOP_MUSIC_HOOKS.duck(0.1);
    NOOP_MUSIC_HOOKS.duckEffects(0.7, { fadeMs: 50 });
    NOOP_MUSIC_HOOKS.stop();
    NOOP_MUSIC_HOOKS.restartBed({ fadeIn: true });
  });
});

afterEach(() => {
  // nothing global
});
