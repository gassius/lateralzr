/**
 * Shared sound types (Sound 1 foundation / Sound 2 preferences).
 *
 * Persistence key `lateralzr.sound` is owned by Sound 2; Sound 1 only consumes
 * prefs via {@link setSoundPreferences} (re-exported from `lib/sound`).
 */

export type SoundPreferences = {
  /** Master: when false, no buses play. */
  sound: boolean;
  music: boolean;
  effects: boolean;
};

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  sound: true,
  music: true,
  effects: true,
};

/** Storage key for Sound 2 persistence (documented here for the stack). */
export const SOUND_PREFERENCES_STORAGE_KEY = 'lateralzr.sound';

export type SoundEvent =
  | { name: 'card_flip' }
  | { name: 'card_flip_back' }
  | { name: 'swipe_next' }
  | { name: 'swipe_back' }
  | { name: 'swipe_cancel' }
  | { name: 'swipe_resistance' }
  | { name: 'complexity_changed'; level: number }
  | { name: 'laterality_step'; step: number }
  | { name: 'reshuffle_started'; random: boolean }
  | { name: 'reshuffle_landed'; random: boolean }
  | { name: 'card_arrived' }
  | { name: 'sheet_open' }
  | { name: 'sheet_close' }
  | { name: 'error_soft' }
  | { name: 'no_match' }
  | { name: 'intro_started' }
  | { name: 'intro_ready' };

export type SoundEventName = SoundEvent['name'];

export type SoundBus = 'effects' | 'music';
