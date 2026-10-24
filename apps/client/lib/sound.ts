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
import type { SoundEvent, SoundPreferences } from '@/lib/soundTypes';

export type { SoundEvent, SoundEventName, SoundPreferences, SoundBus } from '@/lib/soundTypes';
export {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFERENCES_STORAGE_KEY,
} from '@/lib/soundTypes';
export { SOUND_MAP, getSoundMapEntry, playableVariants } from '@/lib/soundMap';
export {
  EFFECTS_POOL_SIZE,
  pickVariantIndex,
  isBusEnabled,
  createSoundController,
  createEffectsPool,
} from '@/lib/soundEngine';

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
export function soundEvent(event: SoundEvent): void {
  controller.soundEvent(event);
}

/** Push persisted prefs into the module (buses on/off). Immediate; music fades, not cut. */
export function setSoundPreferences(prefs: SoundPreferences): void {
  controller.setSoundPreferences(prefs);
}

/** True on native when expo-audio is linked (dev / production builds). */
export function isSoundAvailable(): boolean {
  return controller.isSoundAvailable();
}
