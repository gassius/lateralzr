/**
 * Sound 7 system-behaviour policy (session + ducking levels).
 *
 * Audio director 2026-10-24: mix with other apps' audio (do not duck them);
 * skip starting music when other audio is already playing (when detectable).
 * Effects still play unless silent mode / master off.
 *
 * Native session values are applied only from `lib/sound.ts` (never from the
 * web stub) so Sound 8's path stays free of native session imports.
 */

/** expo-audio `setAudioModeAsync` payload for Lateralzr (native only). */
export const NATIVE_AUDIO_MODE = {
  playsInSilentMode: false,
  shouldPlayInBackground: false,
  interruptionMode: 'mixWithOthers' as const,
  allowsRecording: false,
};

/** Music gain while VoiceOver / TalkBack is enabled. */
export const SCREEN_READER_MUSIC_VOLUME = 0.08;

/** Effects gain while a screen reader is enabled (muted). */
export const SCREEN_READER_EFFECTS_VOLUME = 0;

/** Music gain while a transient interruption ducks (calls / alarms). */
export const INTERRUPTION_MUSIC_DUCK_VOLUME = 0.12;

/** Gentle fade-in after interruption clears or foreground bed restart. */
export const SOUND_RESUME_FADE_IN = true;

/** How long to keep reshuffle SFX suppressed after an AT announcement starts. */
export const ANNOUNCEMENT_SUPPRESS_MS = 2500;
