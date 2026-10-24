/**
 * Native sound module (iOS / Android) — Sound 1 foundation + Sound 7 system.
 *
 * Screens announce events via {@link soundEvent}; they never play files.
 * From Reanimated worklets use `runOnJS(soundEvent)(event)`.
 *
 * Requires a development build (expo-audio is not in Expo Go). See apps/client/AGENTS.md.
 *
 * Sound 7: silent switch, mixWithOthers, AppState stop/restart, screen-reader
 * ducking. Music lifecycle hooks are placeholders until Sound 6 registers players.
 * expo-audio has no JS interruption event — `notifySoundInterruption` is for Sound 6.
 */

import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { createSoundController, type SoundPlayer } from '@/lib/soundEngine';
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

function wrapPlayer(player: AudioPlayer): SoundPlayer {
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
  controller.soundEvent(event, options);
}

/** Push persisted prefs into the module (buses on/off). Immediate; music fades, not cut. */
export function setSoundPreferences(prefs: SoundPreferences): void {
  controller.setSoundPreferences(prefs);
}

/** True on native when expo-audio is linked (dev / production builds). */
export function isSoundAvailable(): boolean {
  return controller.isSoundAvailable();
}

/** Sound 6: register music engine pause/resume/duck/restart hooks. */
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
 * Manual interruption gate for Sound 6 (and tests).
 *
 * expo-audio 57 does **not** expose a JS interruption / audio-focus event —
 * native code pauses/resumes players itself under `mixWithOthers`. Sound 7
 * therefore does not wire this to the OS. Sound 6 may call it when it has its
 * own probe; until then AppState background remains the stop/restart path.
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
