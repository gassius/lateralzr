/**
 * Sound 7 system behaviour: AppState, screen-reader ducking, interruptions.
 *
 * Pure gate math + injectable listeners — no `expo-audio` import (keeps the
 * web / Sound 8 path clean). Native `lib/sound.ts` wires React Native +
 * expo-audio; tests inject mocks.
 */

import {
  ANNOUNCEMENT_SUPPRESS_MS,
  INTERRUPTION_MUSIC_DUCK_VOLUME,
  SCREEN_READER_EFFECTS_VOLUME,
  SCREEN_READER_MUSIC_VOLUME,
  SOUND_RESUME_FADE_IN,
} from '@/lib/soundPolicy';
import type { SoundEventName, SoundPreferences } from '@/lib/soundTypes';

export type SoundAppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | string;

export type SoundSystemFlags = {
  appActive: boolean;
  interrupted: boolean;
  screenReaderEnabled: boolean;
  otherAudioPlaying: boolean;
  announcementActive: boolean;
};

export const DEFAULT_SOUND_SYSTEM_FLAGS: SoundSystemFlags = {
  appActive: true,
  interrupted: false,
  screenReaderEnabled: false,
  otherAudioPlaying: false,
  announcementActive: false,
};

/** Playback decisions derived from prefs + system flags. */
export type SoundPlaybackGates = {
  allowEffects: boolean;
  effectsVolume: number;
  allowMusicStart: boolean;
  musicVolume: number;
  dropInsPaused: boolean;
  suppressReshuffleEffects: boolean;
};

export type SoundMusicLifecycleHooks = {
  pause: () => void;
  resume: (opts: { fadeIn: boolean }) => void;
  duck: (volume: number) => void;
  pauseDropIns: () => void;
  resumeDropIns: () => void;
  stop: () => void;
  /** Foreground: bed restarts with fade-in (Sound 6 plugs real players). */
  restartBed: (opts: { fadeIn: boolean }) => void;
};

export const NOOP_MUSIC_HOOKS: SoundMusicLifecycleHooks = {
  pause: () => {},
  resume: () => {},
  duck: () => {},
  pauseDropIns: () => {},
  resumeDropIns: () => {},
  stop: () => {},
  restartBed: () => {},
};

export function isAppStateActive(status: SoundAppStateStatus): boolean {
  return status === 'active';
}

/**
 * Only `background` means leave the app for Sound 7 stop-all.
 * iOS `inactive` (Control Center, notification shade, call UI transitional)
 * must not stop audio — ignore it in {@link bindSoundSystem}.
 */
export function isAppStateBackground(status: SoundAppStateStatus): boolean {
  return status === 'background';
}

/**
 * Resolve what the engine may play right now.
 * Music never starts over other apps' audio when that is detectable.
 */
export function resolvePlaybackGates(
  prefs: SoundPreferences,
  flags: SoundSystemFlags,
): SoundPlaybackGates {
  const masterOn = Boolean(prefs.sound);
  const musicPref = masterOn && Boolean(prefs.music);
  const effectsPref = masterOn && Boolean(prefs.effects);

  const allowEffects =
    effectsPref && flags.appActive && !flags.screenReaderEnabled && !flags.announcementActive;

  const allowMusicStart =
    musicPref &&
    flags.appActive &&
    !flags.interrupted &&
    !flags.otherAudioPlaying;

  let musicVolume = 1;
  if (flags.screenReaderEnabled) {
    musicVolume = Math.min(musicVolume, SCREEN_READER_MUSIC_VOLUME);
  }
  if (flags.interrupted) {
    musicVolume = Math.min(musicVolume, INTERRUPTION_MUSIC_DUCK_VOLUME);
  }

  const effectsVolume = flags.screenReaderEnabled ? SCREEN_READER_EFFECTS_VOLUME : 1;

  const dropInsPaused =
    !flags.appActive ||
    flags.interrupted ||
    flags.screenReaderEnabled ||
    flags.announcementActive ||
    !musicPref;

  const suppressReshuffleEffects =
    flags.screenReaderEnabled || flags.announcementActive || !flags.appActive;

  return {
    allowEffects,
    effectsVolume,
    allowMusicStart,
    musicVolume,
    dropInsPaused,
    suppressReshuffleEffects,
  };
}

export function shouldPlaySoundEvent(
  name: SoundEventName,
  bus: 'effects' | 'music',
  gates: SoundPlaybackGates,
): boolean {
  if (bus === 'music') {
    return gates.allowMusicStart;
  }
  if (
    gates.suppressReshuffleEffects &&
    (name === 'reshuffle_started' || name === 'reshuffle_landed')
  ) {
    return false;
  }
  return gates.allowEffects;
}

export type SoundSystemHost = {
  /** Apply flags and run side effects (stop / duck / restart). */
  applyFlags: (next: SoundSystemFlags, prev: SoundSystemFlags) => void;
  getFlags: () => SoundSystemFlags;
};

export type SoundSystemBindings = {
  getAppState: () => SoundAppStateStatus;
  subscribeAppState: (listener: (status: SoundAppStateStatus) => void) => {
    remove: () => void;
  };
  isScreenReaderEnabled: () => Promise<boolean>;
  subscribeScreenReader: (listener: (enabled: boolean) => void) => {
    remove: () => void;
  };
  /** Optional: deactivate the audio subsystem in background (expo-audio). */
  setAudioActive?: (active: boolean) => void | Promise<void>;
  /** Optional probe; when omitted / throws, other-audio stays "undetectable" (false). */
  isOtherAudioPlaying?: () => boolean | Promise<boolean>;
  now?: () => number;
  announcementSuppressMs?: number;
};

/**
 * Wire AppState + AccessibilityInfo into a host. Returns dispose + helpers
 * for interruptions / AT announcements / other-audio probes.
 */
export function bindSoundSystem(host: SoundSystemHost, bindings: SoundSystemBindings) {
  const now = bindings.now ?? (() => Date.now());
  const announcementMs = bindings.announcementSuppressMs ?? ANNOUNCEMENT_SUPPRESS_MS;
  let announcementTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function patch(partial: Partial<SoundSystemFlags>): void {
    if (disposed) return;
    const prev = host.getFlags();
    const next: SoundSystemFlags = { ...prev, ...partial };
    if (
      next.appActive === prev.appActive &&
      next.interrupted === prev.interrupted &&
      next.screenReaderEnabled === prev.screenReaderEnabled &&
      next.otherAudioPlaying === prev.otherAudioPlaying &&
      next.announcementActive === prev.announcementActive
    ) {
      return;
    }
    host.applyFlags(next, prev);
  }

  function onAppState(status: SoundAppStateStatus): void {
    // iOS `inactive` must not stop all audio (M1) — ignore transitional states.
    if (status === 'inactive' || status === 'unknown') {
      return;
    }

    const active = isAppStateActive(status);
    const prev = host.getFlags();
    if (active === prev.appActive) return;

    // Deactivate the session only when truly backgrounded, never on inactive.
    if (isAppStateBackground(status) || active) {
      void Promise.resolve(bindings.setAudioActive?.(active)).catch(() => {
        // never break the announce path
      });
    }

    patch({ appActive: active });
  }

  function onScreenReader(enabled: boolean): void {
    patch({ screenReaderEnabled: Boolean(enabled) });
  }

  async function refreshOtherAudio(): Promise<void> {
    if (!bindings.isOtherAudioPlaying) return;
    try {
      const playing = await Promise.resolve(bindings.isOtherAudioPlaying());
      patch({ otherAudioPlaying: Boolean(playing) });
    } catch {
      // Undetectable — leave flag false so we do not block music spuriously.
    }
  }

  function notifyInterruption(began: boolean): void {
    patch({ interrupted: Boolean(began) });
  }

  function beginAnnouncement(): void {
    if (announcementTimer) {
      clearTimeout(announcementTimer);
      announcementTimer = null;
    }
    patch({ announcementActive: true });
    announcementTimer = setTimeout(() => {
      announcementTimer = null;
      patch({ announcementActive: false });
    }, announcementMs);
  }

  function endAnnouncement(): void {
    if (announcementTimer) {
      clearTimeout(announcementTimer);
      announcementTimer = null;
    }
    patch({ announcementActive: false });
  }

  // Initial snapshot.
  onAppState(bindings.getAppState());
  void bindings.isScreenReaderEnabled().then((enabled) => {
    if (!disposed) onScreenReader(enabled);
  });
  void refreshOtherAudio();

  const appSub = bindings.subscribeAppState(onAppState);
  const a11ySub = bindings.subscribeScreenReader(onScreenReader);

  return {
    dispose: () => {
      disposed = true;
      if (announcementTimer) {
        clearTimeout(announcementTimer);
        announcementTimer = null;
      }
      appSub.remove();
      a11ySub.remove();
    },
    notifyInterruption,
    beginAnnouncement,
    endAnnouncement,
    refreshOtherAudio,
    /** Test helper: force a full re-apply of current flags. */
    reapply: () => {
      const flags = host.getFlags();
      host.applyFlags(flags, flags);
    },
    fadeIn: SOUND_RESUME_FADE_IN,
  };
}

/**
 * Apply music-lifecycle side effects for a flags transition.
 * Sound 6 registers real players via {@link SoundMusicLifecycleHooks}.
 */
export function applyMusicLifecycleTransition(
  hooks: SoundMusicLifecycleHooks,
  prefs: SoundPreferences,
  next: SoundSystemFlags,
  prev: SoundSystemFlags,
): void {
  const nextGates = resolvePlaybackGates(prefs, next);
  const prevGates = resolvePlaybackGates(prefs, prev);

  // Background only → stop all sound (inactive is ignored upstream).
  if (prev.appActive && !next.appActive) {
    hooks.stop();
    hooks.pauseDropIns();
    return;
  }

  // Foreground → bed restarts with fade-in when music is allowed.
  if (!prev.appActive && next.appActive) {
    if (nextGates.allowMusicStart) {
      hooks.restartBed({ fadeIn: SOUND_RESUME_FADE_IN });
    }
    if (nextGates.dropInsPaused) {
      hooks.pauseDropIns();
    } else {
      hooks.resumeDropIns();
    }
    if (next.screenReaderEnabled) {
      hooks.duck(SCREEN_READER_MUSIC_VOLUME);
    }
    return;
  }

  // Interruption began → pause (or duck) music; clear → gentle resume.
  // Note: expo-audio has no JS interruption event; native players pause/resume
  // themselves. `interrupted` is for Sound 6 / manual notifySoundInterruption.
  if (!prev.interrupted && next.interrupted) {
    hooks.pause();
    hooks.pauseDropIns();
    return;
  }
  if (prev.interrupted && !next.interrupted) {
    if (nextGates.allowMusicStart) {
      hooks.resume({ fadeIn: SOUND_RESUME_FADE_IN });
    }
    if (!nextGates.dropInsPaused) {
      hooks.resumeDropIns();
    }
    if (next.screenReaderEnabled) {
      hooks.duck(SCREEN_READER_MUSIC_VOLUME);
    } else {
      hooks.duck(1);
    }
    return;
  }

  // Screen reader toggled.
  if (!prev.screenReaderEnabled && next.screenReaderEnabled) {
    hooks.duck(SCREEN_READER_MUSIC_VOLUME);
    hooks.pauseDropIns();
    return;
  }
  if (prev.screenReaderEnabled && !next.screenReaderEnabled) {
    // Restore full music level after VoiceOver/TalkBack (M2).
    hooks.duck(1);
    if (nextGates.allowMusicStart) {
      hooks.resume({ fadeIn: SOUND_RESUME_FADE_IN });
    }
    if (!nextGates.dropInsPaused) {
      hooks.resumeDropIns();
    }
    return;
  }

  // Drop-in pause gate without other transitions.
  if (prevGates.dropInsPaused !== nextGates.dropInsPaused) {
    if (nextGates.dropInsPaused) hooks.pauseDropIns();
    else hooks.resumeDropIns();
  }

  // Other audio appeared while we might want to start — Sound 6 checks
  // allowMusicStart; we do not yank a running bed mid-mix (director: mix).
  void nextGates.allowMusicStart;
}
