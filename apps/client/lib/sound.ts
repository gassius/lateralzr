/**
 * Native sound module (iOS / Android) — Sound 1 foundation.
 *
 * Screens announce events via {@link soundEvent}; they never play files.
 * From Reanimated worklets use `runOnJS(soundEvent)(event)`.
 *
 * Requires a development build (expo-audio is not in Expo Go). See apps/client/AGENTS.md.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { createSoundController, type SoundPlayer } from '@/lib/soundEngine';
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
 * Minimal session: respect silent switch, mix with others, do not duck.
 * Sound 7 owns richer interruption / "other app playing" policy — do not fight it.
 */
async function configureNativeSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
  });
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

/**
 * Sound 7 announcement window — suppress reshuffle SFX while AT speaks.
 * Real suppress lands with Sound 7's system binder; no-op until that merges.
 */
export function beginSoundAnnouncement(): void {
  // no-op on Sound 4/5 stack; Sound 7 replaces with announcementActive flag
}

/** End the Sound 7 announcement suppress window (no-op until Sound 7 merges). */
export function endSoundAnnouncement(): void {
  // no-op on Sound 4/5 stack
}
