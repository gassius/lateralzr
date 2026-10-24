/**
 * Web sound module (Sound 8) — same public API as native `lib/sound.ts`.
 *
 * Thin Web Audio implementation (no native-only / expo-audio imports). Autoplay:
 * silent until the first `pointerdown` / `keydown`. Effects may play after
 * unlock; music waits until {@link notifySoundFirstCardReady}.
 *
 * Assets: Sound 3 `lib/soundAssets.web.ts` (`.web.m4a` requires) +
 * `assets/audio/manifest.json` `durationMs`. Looping sets
 * `AudioBufferSourceNode.loopEnd` from durationMs — never buffer.duration
 * (AAC padding on `music-intro-loop` ~14 ms would click/gap).
 *
 * Decode cache: module-level `Map<uri, Promise<AudioBuffer>>` warmed by
 * preload; players reuse resolved buffers and defer `start()` until decode
 * finishes (unless pause/release cancelled the pending play).
 */

import { loopEndSecondsFromManifest } from '@/lib/audioManifest';
import {
  getSoundAssetDurationMsForModule,
  SOUND_ASSETS,
  type SoundAssetName,
} from '@/lib/soundAssets';
import { createSoundController, type SoundPlayer } from '@/lib/soundEngine';
import {
  getSoundMapEntry,
  playableVariants,
  SOUND_MAP,
  type SoundAssetRef,
} from '@/lib/soundMap';
import type {
  SoundMusicLifecycleHooks,
  SoundSystemFlags,
} from '@/lib/soundSystem';
import type {
  SoundEvent,
  SoundEventName,
  SoundEventOptions,
  SoundPreferences,
} from '@/lib/soundTypes';

/** Lazy so Node unit tests can import this module without loading react-native. */
function assetFromModule(moduleId: number): { uri?: string | null; localUri?: string | null; downloadAsync: () => Promise<unknown> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Asset } = require('expo-asset') as typeof import('expo-asset');
    return Asset.fromModule(moduleId);
  } catch {
    return null;
  }
}

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
  AUDIO_MANIFEST,
  getAudioManifestAsset,
  loopEndSecondsFromManifest,
} from '@/lib/audioManifest';
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
export type {
  SoundMusicLifecycleHooks,
  SoundSystemFlags,
  SoundPlaybackGates,
} from '@/lib/soundSystem';
export { runAccessibilityAnnounce } from '@/lib/soundAnnounce';

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function browserSupportsAudio(): boolean {
  return getAudioContextCtor() != null;
}

function isMusicEventName(name: SoundEventName): boolean {
  return getSoundMapEntry(name).bus === 'music';
}

/** Shared decode cache — preload warms; players reuse (no double fetch). */
const bufferPromises = new Map<string, Promise<AudioBuffer>>();
const resolvedBuffers = new Map<string, AudioBuffer>();

/**
 * Resolve a Sound 3 module id (or runtime string URL) to a fetchable URI.
 * Metro packs `.web.m4a` requires as asset modules — use expo-asset on web.
 */
function resolvePlayableUri(source: SoundAssetRef | string): string | null {
  if (source == null) return null;
  const raw = source as unknown;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (typeof raw !== 'number') return null;
  const asset = assetFromModule(raw);
  if (!asset) return null;
  const uri = asset.localUri ?? asset.uri;
  return typeof uri === 'string' && uri.length > 0 ? uri : null;
}

function metaForSource(source: SoundAssetRef | string): {
  durationMs: number | null;
  loop: boolean;
} {
  if (source == null) return { durationMs: null, loop: false };
  if (typeof source === 'number') {
    const durationMs = getSoundAssetDurationMsForModule(source);
    for (const name of Object.keys(SOUND_ASSETS) as SoundAssetName[]) {
      if (SOUND_ASSETS[name].module === source) {
        return { durationMs: SOUND_ASSETS[name].durationMs, loop: SOUND_ASSETS[name].loop };
      }
    }
    return { durationMs, loop: false };
  }
  // Runtime string URL — look up by matching resolved uri is expensive; no loop.
  return { durationMs: null, loop: false };
}

function decodeUri(ctx: AudioContext, uri: string): Promise<AudioBuffer> {
  const existing = bufferPromises.get(uri);
  if (existing) return existing;

  const promise = (async (): Promise<AudioBuffer> => {
    if (typeof fetch !== 'function') {
      throw new Error('sound: fetch unavailable');
    }
    const res = await fetch(uri);
    if (!res.ok) throw new Error('sound: audio fetch failed');
    const ab = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab.slice(0));
    resolvedBuffers.set(uri, decoded);
    return decoded;
  })().catch((err: unknown) => {
    bufferPromises.delete(uri);
    resolvedBuffers.delete(uri);
    throw err;
  });

  bufferPromises.set(uri, promise);
  return promise;
}

/** Warm cache only — no GainNode / player allocation. */
function warmBufferCache(ctx: AudioContext, uri: string): void {
  void decodeUri(ctx, uri).catch(() => {
    // ignore decode/fetch failures
  });
}

/** No-op player when Web Audio is missing or decode fails. */
function createSilentPlayer(): SoundPlayer {
  let volume = 1;
  return {
    get volume() {
      return volume;
    },
    set volume(v: number) {
      volume = v;
    },
    get playing() {
      return false;
    },
    play() {},
    pause() {},
    replace() {},
    seekTo() {},
    release() {},
  };
}

function createWebAudioPlayer(
  ctx: AudioContext,
  source: SoundAssetRef | string,
): SoundPlayer {
  let sourceRef: SoundAssetRef | string = source;
  let uri = resolvePlayableUri(sourceRef);
  let assetMeta = metaForSource(sourceRef);
  let buffer: AudioBuffer | null = uri != null ? (resolvedBuffers.get(uri) ?? null) : null;
  let node: AudioBufferSourceNode | null = null;
  let playing = false;
  let volume = 1;
  let wantsPlay = false;
  let playToken = 0;
  let replaceToken = 0;

  const gain = ctx.createGain();
  try {
    gain.connect(ctx.destination);
  } catch {
    return createSilentPlayer();
  }
  gain.gain.value = volume;

  function stopNode(): void {
    if (node) {
      try {
        node.onended = null;
        node.stop();
      } catch {
        // ignore
      }
      try {
        node.disconnect();
      } catch {
        // ignore
      }
      node = null;
    }
    playing = false;
  }

  function applyLoop(sourceNode: AudioBufferSourceNode): void {
    if (!assetMeta.loop) {
      sourceNode.loop = false;
      return;
    }
    sourceNode.loop = true;
    sourceNode.loopStart = 0;
    // Director: loopEnd from durationMs, never buffer.duration (AAC padding).
    const end = loopEndSecondsFromManifest(assetMeta.durationMs);
    if (end != null) {
      sourceNode.loopEnd = end;
    }
  }

  function startFromBuffer(buf: AudioBuffer): void {
    stopNode();
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const next = ctx.createBufferSource();
      next.buffer = buf;
      applyLoop(next);
      next.connect(gain);
      next.onended = () => {
        playing = false;
      };
      next.start(0);
      node = next;
      playing = true;
    } catch {
      playing = false;
    }
  }

  function bindResolvedBuffer(nextUri: string | null): void {
    const token = ++replaceToken;
    buffer = nextUri != null ? (resolvedBuffers.get(nextUri) ?? null) : null;
    if (nextUri == null || buffer != null) return;
    void decodeUri(ctx, nextUri)
      .then((decoded) => {
        if (token !== replaceToken) return;
        if (uri !== nextUri) return;
        buffer = decoded;
      })
      .catch(() => {
        // ignore
      });
  }

  if (uri != null && buffer == null) {
    bindResolvedBuffer(uri);
  }

  return {
    get volume() {
      return volume;
    },
    set volume(v: number) {
      volume = Math.max(0, Math.min(1, v));
      try {
        gain.gain.value = volume;
      } catch {
        // ignore
      }
    },
    get playing() {
      return playing;
    },
    play() {
      wantsPlay = true;
      const token = ++playToken;
      const playUri = uri;
      if (playUri == null) return;

      const tryStart = (buf: AudioBuffer): void => {
        if (token !== playToken || !wantsPlay) return;
        buffer = buf;
        startFromBuffer(buf);
      };

      const resolved = resolvedBuffers.get(playUri) ?? buffer;
      if (resolved) {
        tryStart(resolved);
        return;
      }

      void decodeUri(ctx, playUri)
        .then(tryStart)
        .catch(() => {
          // ignore
        });
    },
    pause() {
      wantsPlay = false;
      playToken += 1;
      stopNode();
    },
    replace(nextSource) {
      wantsPlay = false;
      playToken += 1;
      stopNode();
      sourceRef = nextSource;
      uri = resolvePlayableUri(nextSource);
      assetMeta = metaForSource(nextSource);
      bindResolvedBuffer(uri);
    },
    seekTo(_seconds) {
      // Buffer sources restart from 0 on next play; seek is a no-op stub.
    },
    release() {
      wantsPlay = false;
      playToken += 1;
      replaceToken += 1;
      stopNode();
      buffer = null;
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    },
  };
}

const available = browserSupportsAudio();

let sharedCtx: AudioContext | null = null;

function getOrCreateContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    sharedCtx = new Ctor();
    return sharedCtx;
  } catch {
    return null;
  }
}

const controller = createSoundController({
  createPlayer: (source) => {
    try {
      const ctx = getOrCreateContext();
      if (!ctx) return createSilentPlayer();
      return createWebAudioPlayer(ctx, source);
    } catch {
      return createSilentPlayer();
    }
  },
  available,
});

let unlocked = false;
let musicAllowed = false;
/** Latest pending music event per name (intro_started + intro_ready both kept). */
const pendingMusicByName = new Map<SoundEventName, SoundEvent>();
let unlockListenersAttached = false;
let effectsPreloadStarted = false;
let musicPreloadStarted = false;

function preloadModule(moduleId: number): void {
  const uri = resolvePlayableUri(moduleId);
  const ctx = getOrCreateContext();
  if (!ctx) return;
  const asset = assetFromModule(moduleId);
  if (asset) {
    void asset
      .downloadAsync()
      .then(() => {
        const warmUri = resolvePlayableUri(moduleId);
        if (warmUri) warmBufferCache(ctx, warmUri);
      })
      .catch(() => {
        if (uri) warmBufferCache(ctx, uri);
      });
    return;
  }
  if (uri) warmBufferCache(ctx, uri);
}

function collectBusModules(bus: 'effects' | 'music'): number[] {
  const out: number[] = [];
  for (const eventName of Object.keys(SOUND_MAP) as SoundEventName[]) {
    const entry = getSoundMapEntry(eventName);
    if (entry.bus !== bus) continue;
    for (const variant of playableVariants(entry)) {
      if (typeof variant === 'number') out.push(variant);
    }
  }
  return out;
}

function preloadEffects(): void {
  if (effectsPreloadStarted) return;
  effectsPreloadStarted = true;
  for (const moduleId of collectBusModules('effects')) {
    preloadModule(moduleId);
  }
}

function preloadMusic(): void {
  if (musicPreloadStarted) return;
  musicPreloadStarted = true;
  for (const moduleId of collectBusModules('music')) {
    preloadModule(moduleId);
  }
}

function flushPendingMusic(): void {
  if (!unlocked || !musicAllowed || pendingMusicByName.size === 0) return;
  const events = [...pendingMusicByName.values()];
  pendingMusicByName.clear();
  for (const event of events) {
    try {
      controller.soundEvent(event);
    } catch {
      // ignore
    }
  }
}

function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const ctx = getOrCreateContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  preloadEffects();
  flushPendingMusic();
}

function attachUnlockListeners(): void {
  if (unlockListenersAttached) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }
  unlockListenersAttached = true;

  const onGesture = (): void => {
    unlockAudio();
    try {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    } catch {
      // ignore
    }
  };

  try {
    window.addEventListener('pointerdown', onGesture, { capture: true, once: true });
    window.addEventListener('keydown', onGesture, { capture: true, once: true });
  } catch {
    unlockListenersAttached = false;
  }
}

attachUnlockListeners();

/** Announce UI/game events. Silent until unlock; music until first card ready. */
export function soundEvent(event: SoundEvent, options?: SoundEventOptions): void {
  try {
    if (!available) return;

    if (isMusicEventName(event.name)) {
      if (!unlocked || !musicAllowed) {
        pendingMusicByName.set(event.name, event);
        return;
      }
      controller.soundEvent(event, options);
      return;
    }

    if (!unlocked) return;
    controller.soundEvent(event, options);
  } catch {
    // Failures are silent no-ops — never crash the announce path.
  }
}

/** Push persisted prefs into the module (buses on/off). */
export function setSoundPreferences(prefs: SoundPreferences): void {
  try {
    controller.setSoundPreferences(prefs);
  } catch {
    // ignore
  }
}

/**
 * True in browsers with Web Audio. Menu / Sound 2 use this on web preview
 * (Master: web plays sound).
 */
export function isSoundAvailable(): boolean {
  return available;
}

/**
 * Allow the music bus after the first card is ready. Effects may already be
 * playing post-unlock; bed starts here when prefs allow (and unlock happened).
 */
export function notifySoundFirstCardReady(): void {
  try {
    if (musicAllowed) return;
    musicAllowed = true;
    preloadMusic();
    flushPendingMusic();
  } catch {
    // ignore
  }
}

/** Sound 6: register music engine pause/resume/duck/restart hooks. */
export function registerSoundMusicHooks(
  hooks: Partial<SoundMusicLifecycleHooks> | null,
): void {
  try {
    controller.registerMusicHooks(hooks);
  } catch {
    // ignore
  }
}

export function pauseSoundMusic(): void {
  try {
    controller.pauseMusic();
  } catch {
    // ignore
  }
}

export function resumeSoundMusic(opts?: { fadeIn?: boolean }): void {
  try {
    controller.resumeMusic(opts);
  } catch {
    // ignore
  }
}

export function duckSoundMusic(volume: number): void {
  try {
    controller.duckMusic(volume);
  } catch {
    // ignore
  }
}

export function stopAllSound(): void {
  try {
    controller.stopAllSound();
  } catch {
    // ignore
  }
}

export function canStartMusic(): boolean {
  if (!available) return false;
  try {
    return controller.canStartMusic();
  } catch {
    return false;
  }
}

export function getSoundSystemFlags(): SoundSystemFlags {
  return controller.getSystemFlags();
}

export function notifySoundInterruption(began: boolean): void {
  try {
    const prev = controller.getSystemFlags();
    controller.applySystemFlags({ ...prev, interrupted: Boolean(began) });
  } catch {
    // ignore
  }
}

/** Suppress reshuffle SFX while AT speaks — flags feed Sound 7 engine gates. */
export function beginSoundAnnouncement(): void {
  try {
    const prev = controller.getSystemFlags();
    controller.applySystemFlags({ ...prev, announcementActive: true });
  } catch {
    // ignore
  }
}

export function endSoundAnnouncement(): void {
  try {
    const prev = controller.getSystemFlags();
    controller.applySystemFlags({ ...prev, announcementActive: false });
  } catch {
    // ignore
  }
}

export function setOtherAudioPlayingProbe(
  _probe: (() => boolean | Promise<boolean>) | null,
): void {
  // Web preview has no reliable other-app probe; leave flag false.
  try {
    const prev = controller.getSystemFlags();
    if (prev.otherAudioPlaying) {
      controller.applySystemFlags({ ...prev, otherAudioPlaying: false });
    }
  } catch {
    // ignore
  }
}

/** Test helper — not part of the public Sound 1↔2 API. */
export function __getWebSoundPreferencesForTests(): SoundPreferences {
  return controller.getPreferences();
}

/** Test helper — no AppState/a11y listeners on web. */
export function __disposeSoundSystemForTests(): void {
  // no listeners on web
}

/** Test helper — reset unlock / defer / pool / decode-cache state. */
export function __resetWebSoundForTests(): void {
  unlocked = false;
  musicAllowed = false;
  pendingMusicByName.clear();
  effectsPreloadStarted = false;
  musicPreloadStarted = false;
  unlockListenersAttached = false;
  bufferPromises.clear();
  resolvedBuffers.clear();
  controller.reset();
  attachUnlockListeners();
}

/** Test helper — simulate first gesture unlock. */
export function __unlockWebSoundForTests(): void {
  unlockAudio();
}

/** Test helper — shared decode (fills buffer cache). */
export function __decodeUriForTests(ctx: AudioContext, uri: string): Promise<AudioBuffer> {
  return decodeUri(ctx, uri);
}

/** Test helper — warm cache without creating a player. */
export function __warmBufferCacheForTests(ctx: AudioContext, uri: string): void {
  warmBufferCache(ctx, uri);
}

/** Test helper — create a Web Audio player against an injected context. */
export function __createWebAudioPlayerForTests(
  ctx: AudioContext,
  source: SoundAssetRef | string,
): SoundPlayer {
  return createWebAudioPlayer(ctx, source as SoundAssetRef);
}

/** Test helper — clear decode cache only. */
export function __clearWebBufferCacheForTests(): void {
  bufferPromises.clear();
  resolvedBuffers.clear();
}
