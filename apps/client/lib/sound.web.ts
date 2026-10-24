/**
 * Web sound stub (Sound 1 / Sound 8 preview).
 *
 * Metro resolves this file on web so native-only `expo-audio` session code and
 * AppState/AccessibilityInfo system binding never import at the shared module
 * top level. Until Sound 8 unlocks web audio, prefer honest unavailability.
 */

import { DEFAULT_SOUND_SYSTEM_FLAGS, NOOP_MUSIC_HOOKS } from '@/lib/soundSystem';
import type { SoundMusicLifecycleHooks, SoundSystemFlags } from '@/lib/soundSystem';
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

let prefs: SoundPreferences = {
  sound: true,
  music: true,
  effects: true,
};

let systemFlags: SoundSystemFlags = { ...DEFAULT_SOUND_SYSTEM_FLAGS };
let musicHooks: SoundMusicLifecycleHooks = { ...NOOP_MUSIC_HOOKS };

/** Announce UI/game events. Always a no-op on web until Sound 8. */
export function soundEvent(_event: SoundEvent, _options?: SoundEventOptions): void {
  // no-op
}

/** Accept prefs so Sound 2 can call the same API; no buses play on web yet. */
export function setSoundPreferences(next: SoundPreferences): void {
  prefs = {
    sound: Boolean(next.sound),
    music: Boolean(next.music),
    effects: Boolean(next.effects),
  };
}

/**
 * Honest availability until Sound 8 ships a web unlock path.
 * Hide Sound menu row on web preview.
 */
export function isSoundAvailable(): boolean {
  return false;
}

export function registerSoundMusicHooks(
  hooks: Partial<SoundMusicLifecycleHooks> | null,
): void {
  musicHooks = { ...NOOP_MUSIC_HOOKS, ...(hooks ?? {}) };
}

export function pauseSoundMusic(): void {
  musicHooks.pause();
}

export function resumeSoundMusic(opts?: { fadeIn?: boolean }): void {
  musicHooks.resume({ fadeIn: opts?.fadeIn !== false });
}

export function duckSoundMusic(volume: number): void {
  musicHooks.duck(volume);
}

export function stopAllSound(): void {
  musicHooks.stop();
  musicHooks.pauseDropIns();
}

export function canStartMusic(): boolean {
  return false;
}

export function getSoundSystemFlags(): SoundSystemFlags {
  return { ...systemFlags };
}

export function notifySoundInterruption(_began: boolean): void {
  // no-op on web until Sound 8
}

/** Sound 7 announcement hooks (web tracks flag only; no native session). */
export function beginSoundAnnouncement(): void {
  systemFlags = { ...systemFlags, announcementActive: true };
}

export function endSoundAnnouncement(): void {
  systemFlags = { ...systemFlags, announcementActive: false };
}

export function setOtherAudioPlayingProbe(
  _probe: (() => boolean | Promise<boolean>) | null,
): void {
  // no-op
}

/** Test helper — not part of the public Sound 1↔2 API. */
export function __getWebSoundPreferencesForTests(): SoundPreferences {
  return { ...prefs };
}

export function __disposeSoundSystemForTests(): void {
  // no listeners on web stub
}
