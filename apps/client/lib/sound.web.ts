/**
 * Web sound stub (Sound 1 / Sound 8 preview).
 *
 * Metro resolves this file on web so native-only `expo-audio` is never imported
 * at the shared module top level. Until Sound 8 unlocks web audio, prefer
 * honest unavailability and safe no-ops.
 */

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

let prefs: SoundPreferences = {
  sound: true,
  music: true,
  effects: true,
};

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

/** Sound 7 announcement hooks (web no-op; real suppress on native Sound 7). */
export function beginSoundAnnouncement(): void {
  // no-op
}

export function endSoundAnnouncement(): void {
  // no-op
}

/** Test helper — not part of the public Sound 1↔2 API. */
export function __getWebSoundPreferencesForTests(): SoundPreferences {
  return { ...prefs };
}
