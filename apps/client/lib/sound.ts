/**
 * Native sound module (iOS / Android) — Sound 1 + Sound 6 music + Sound 7 system.
 *
 * Screens announce events via {@link soundEvent}; they never play files.
 * From Reanimated worklets use `runOnJS(soundEvent)(event)`.
 *
 * Requires a development build (expo-audio is not in Expo Go). See apps/client/AGENTS.md.
 *
 * Sound 6: generative music engine (`lib/soundMusic.ts`) registers into Sound 7
 * lifecycle hooks. Loop lengths come from manifest `durationMs` (AAC padding) —
 * native has no `loopEnd`; dual-copy crossfade uses the same seconds value Sound 8
 * sets as web `loopEnd`.
 *
 * Sound 7: silent switch, mixWithOthers, AppState stop/restart, screen-reader
 * ducking; music lifecycle via hooks Sound 6 registers below.
 * expo-audio has no JS interruption event — `notifySoundInterruption` is manual/tests.
 */

import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import {
  getSoundAsset,
  getSoundAssetDurationMs,
  type SoundAssetName,
} from '@/lib/soundAssets';
import { createSoundController, type SoundPlayer } from '@/lib/soundEngine';
import { getSoundMapEntry } from '@/lib/soundMap';
import {
  createSoundMusicEngine,
  loopEndSecondsFromDurationMs,
  type MusicPlayer,
} from '@/lib/soundMusic';
import { NATIVE_AUDIO_MODE } from '@/lib/soundPolicy';
import {
  bindSoundSystem,
  type SoundMusicLifecycleHooks,
  type SoundSystemFlags,
} from '@/lib/soundSystem';
import type { SoundEvent, SoundEventOptions, SoundPreferences } from '@/lib/soundTypes';

export type {
  SoundEvent,
  SoundEventName,
  SoundEventOptions,
  SoundPreferences,
  SoundBus,
} from '@/lib/soundTypes';
export {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFERENCES_STORAGE_KEY,
} from '@/lib/soundTypes';
export {
  SOUND_MAP,
  getSoundMapEntry,
  playableVariants,
  ENABLE_SWIPE_TONE_LAYERS,
  SWIPE_TONE_LAYER_GAIN_DB,
  REDUCED_MOTION_SFX_GAIN_DB,
  REDUCED_MOTION_SFX_PLAY_RATIO,
  REDUCED_MOTION_SFX_FADE_MS,
  MOTION_TIED_SOUND_EVENTS,
  BIG_MOVEMENT_SOUND_EVENTS,
  gainFromDb,
  resolveEventGain,
  shouldShortenReducedMotionFade,
} from '@/lib/soundMap';
export {
  EFFECTS_POOL_SIZE,
  pickVariantIndex,
  isBusEnabled,
  createSoundController,
  createEffectsPool,
  resolveLadderSource,
  resolveReshuffleLandSource,
  scheduleReducedMotionFade,
} from '@/lib/soundEngine';
export {
  SOUND_ASSETS,
  SOUND_VARIANT_GROUPS,
  getSoundAsset,
  getSoundAssetDurationMs,
  getSoundAssetDurationMsForModule,
  resolveVariantModules,
  type SoundAssetName,
  type SoundAssetMeta,
} from '@/lib/soundAssets';
export {
  NATIVE_AUDIO_MODE,
  SCREEN_READER_MUSIC_VOLUME,
  SCREEN_READER_EFFECTS_VOLUME,
  SOUND_RESUME_FADE_IN,
} from '@/lib/soundPolicy';
export {
  resolvePlaybackGates,
  shouldPlaySoundEvent,
  DEFAULT_SOUND_SYSTEM_FLAGS,
  NOOP_MUSIC_HOOKS,
} from '@/lib/soundSystem';
export type { SoundMusicLifecycleHooks, SoundSystemFlags, SoundPlaybackGates } from '@/lib/soundSystem';
export { runAccessibilityAnnounce } from '@/lib/soundAnnounce';
export {
  createSoundMusicEngine,
  computeMusicProgress,
  textureCountForProgress,
  bedAssetForProgress,
  loopEndSecondsFromDurationMs,
  MUSIC_MAX_PLAYERS,
  MUSIC_INTRO_LOOP,
} from '@/lib/soundMusic';

function wrapPlayer(player: AudioPlayer): SoundPlayer & MusicPlayer {
  return {
    get volume() {
      return player.volume;
    },
    set volume(v: number) {
      player.volume = v;
    },
    get playing() {
      return player.playing;
    },
    get loop() {
      return player.loop;
    },
    set loop(v: boolean) {
      player.loop = v;
    },
    play() {
      player.play();
    },
    pause() {
      player.pause();
    },
    replace(source) {
      if (source == null) return;
      player.replace(source);
    },
    seekTo(seconds) {
      return player.seekTo(seconds);
    },
    release() {
      player.release();
    },
  };
}

/**
 * Never override the system: respect iOS silent switch / Android ringer,
 * mix with other apps (do not duck them), no background audio session.
 */
async function configureNativeSession(): Promise<void> {
  await setAudioModeAsync({ ...NATIVE_AUDIO_MODE });
}

const controller = createSoundController({
  createPlayer: (source) => {
    if (source == null) {
      throw new Error('sound: missing asset');
    }
    return wrapPlayer(createAudioPlayer(source));
  },
  configureSession: configureNativeSession,
  available: true,
});

const musicEngine = createSoundMusicEngine({
  createPlayer: (source) => {
    if (source == null) {
      throw new Error('sound music: missing asset');
    }
    const player = wrapPlayer(createAudioPlayer(source));
    // Never rely on native `loop` alone — crossfade from durationMs instead.
    player.loop = false;
    return player;
  },
  resolveModule: (name: SoundAssetName) => getSoundAsset(name).module,
  getDurationMs: (name) => getSoundAssetDurationMs(name),
  canStartMusic: () => controller.canStartMusic(),
  areDropInsBlocked: () => {
    const flags = controller.getSystemFlags();
    return flags.screenReaderEnabled || flags.announcementActive || flags.interrupted;
  },
});

/** Intro-loop end (seconds) from manifest — mirrors Sound 8 web `loopEnd`. */
export const NATIVE_INTRO_LOOP_END_SECONDS = loopEndSecondsFromDurationMs(
  getSoundAssetDurationMs('music-intro-loop'),
);

controller.registerMusicHooks({
  pause: () => musicEngine.pause(),
  resume: (opts) => musicEngine.resume(opts),
  duck: (volume) => musicEngine.duck(volume),
  stop: () => musicEngine.stop(),
  restartBed: (opts) => musicEngine.restartBed(opts),
  pauseDropIns: () => musicEngine.pauseDropIns(),
  resumeDropIns: () => musicEngine.resumeDropIns(),
});

const systemBinding = bindSoundSystem(
  {
    getFlags: () => controller.getSystemFlags(),
    applyFlags: (next) => {
      controller.applySystemFlags(next);
    },
  },
  {
    getAppState: () => AppState.currentState as AppStateStatus,
    subscribeAppState: (listener) => {
      const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
        listener(next);
      });
      return { remove: () => sub.remove() };
    },
    isScreenReaderEnabled: () => AccessibilityInfo.isScreenReaderEnabled(),
    subscribeScreenReader: (listener) => {
      const sub = AccessibilityInfo.addEventListener('screenReaderChanged', listener);
      return { remove: () => sub.remove() };
    },
    setAudioActive: (active) => setIsAudioActiveAsync(active),
    // expo-audio does not expose isOtherAudioPlaying; leave undetectable (false)
    // unless a future probe is registered via setOtherAudioPlayingProbe.
  },
);

let otherAudioProbe: (() => boolean | Promise<boolean>) | null = null;

function setOtherAudioFlag(playing: boolean): void {
  const prev = controller.getSystemFlags();
  if (prev.otherAudioPlaying === playing) return;
  controller.applySystemFlags({ ...prev, otherAudioPlaying: playing });
}

/** Optional probe for "another app is already playing" (when detectable). */
export function setOtherAudioPlayingProbe(
  probe: (() => boolean | Promise<boolean>) | null,
): void {
  otherAudioProbe = probe;
  void refreshOtherAudioPlaying();
}

async function refreshOtherAudioPlaying(): Promise<void> {
  if (!otherAudioProbe) {
    setOtherAudioFlag(false);
    return;
  }
  try {
    const playing = await Promise.resolve(otherAudioProbe());
    setOtherAudioFlag(Boolean(playing));
  } catch {
    // Undetectable — do not block music spuriously.
    setOtherAudioFlag(false);
  }
}

/** Announce UI/game events. Safe no-op if disabled or missing assets. */
export function soundEvent(event: SoundEvent, options?: SoundEventOptions): void {
  // Music engine owns beds / intro / textures / drop-ins / discovery ducks.
  musicEngine.handleEvent(event);

  const entry = getSoundMapEntry(event.name);
  if (entry.bus === 'music') {
    // Do not also play music assets through the effects pool.
    return;
  }
  controller.soundEvent(event, options);
}

/** Push persisted prefs into the module (buses on/off). Immediate; music fades, not cut. */
export function setSoundPreferences(prefs: SoundPreferences): void {
  controller.setSoundPreferences(prefs);
  musicEngine.setEnabled(Boolean(prefs.sound && prefs.music));
}

/** Reduced Motion → fewer texture layers (cap 1). */
export function setSoundReducedMotion(enabled: boolean): void {
  musicEngine.setReducedMotion(enabled);
}

/** Drive bed brightness / texture count from Complexity + Laterality. */
export function setSoundMusicProgress(complexity: number, lateralityStep: number): void {
  musicEngine.setProgressInputs(complexity, lateralityStep);
}

/** True on native when expo-audio is linked (dev / production builds). */
export function isSoundAvailable(): boolean {
  return controller.isSoundAvailable();
}

/** Sound 6: register music engine pause/resume/duck/restart hooks (tests / overrides). */
export function registerSoundMusicHooks(
  hooks: Partial<SoundMusicLifecycleHooks> | null,
): void {
  controller.registerMusicHooks(hooks);
}

/** Sound 7 thin surface — Sound 6 may also call these. */
export function pauseSoundMusic(): void {
  controller.pauseMusic();
}

export function resumeSoundMusic(opts?: { fadeIn?: boolean }): void {
  controller.resumeMusic(opts);
}

export function duckSoundMusic(volume: number): void {
  controller.duckMusic(volume);
}

export function stopAllSound(): void {
  controller.stopAllSound();
}

export function canStartMusic(): boolean {
  // Prefer a sync probe read so Sound 6 can gate bed starts without racing.
  if (otherAudioProbe) {
    try {
      const result = otherAudioProbe();
      if (typeof result === 'boolean') {
        setOtherAudioFlag(result);
      } else {
        void result.then(
          (playing) => setOtherAudioFlag(Boolean(playing)),
          () => setOtherAudioFlag(false),
        );
      }
    } catch {
      setOtherAudioFlag(false);
    }
  }
  return controller.canStartMusic();
}

export function getSoundSystemFlags(): SoundSystemFlags {
  return controller.getSystemFlags();
}

/**
 * Manual / test interruption gate.
 *
 * **Outcome (Sound 6 owned deferral):** expo-audio 57 `AudioEventKeys` are only
 * playback / sample / recording / playlist — there is **no** JS interruption or
 * audio-focus event. `mediaServicesDidReset` is an iOS media-daemon crash flag,
 * not a call/alarm interrupt. OS wiring is therefore **not** possible; this hook
 * stays for manual calls and unit tests. AppState `background` remains the
 * automatic stop/restart path (Sound 7).
 */
export function notifySoundInterruption(began: boolean): void {
  systemBinding.notifyInterruption(began);
}

/**
 * Suppress reshuffle SFX while AT speaks (e.g. "Loading a new neighborhood").
 * Wired from DeckStatusLine via `runAccessibilityAnnounce`.
 */
export function beginSoundAnnouncement(): void {
  systemBinding.beginAnnouncement();
}

export function endSoundAnnouncement(): void {
  systemBinding.endAnnouncement();
}

/** Test helper — dispose AppState / a11y listeners. */
export function __disposeSoundSystemForTests(): void {
  systemBinding.dispose();
}

/**
 * Web-only: allow music after the first card is ready. Native has no gesture
 * unlock / deferred music gate — this is a no-op so shared callers can import
 * from `@/lib/sound` on both platforms.
 */
export function notifySoundFirstCardReady(): void {
  // no-op on native
}

/** Test helper — music engine diagnostics. */
export function __getMusicEngineForTests() {
  return musicEngine;
}
