/**
 * Pure sound engine: variant pick, effects pool, anti-stacking, bus prefs.
 * Native `lib/sound.ts` wires expo-audio; tests inject mock players.
 *
 * Pitch shift intentionally omitted (audio director 2026-10-24).
 * Tone layers + reduced-motion gain: Sound 4 (see `lib/soundMap.ts`).
 * Big-movement RM fade shorten + Random wide land: Sound 5.
 * Sound 7: thin pause/resume/duck + system gates (Sound 6 plugs music hooks).
 */

import {
  getSoundAssetDurationMsForModule,
  SOUND_ASSETS,
  type SoundAssetName,
} from '@/lib/soundAssets';
import {
  ENABLE_SWIPE_TONE_LAYERS,
  getSoundMapEntry,
  playableVariants,
  REDUCED_MOTION_SFX_FADE_MS,
  REDUCED_MOTION_SFX_PLAY_RATIO,
  resolveEventGain,
  shouldShortenReducedMotionFade,
  swipeToneModule,
  SWIPE_TONE_LAYER_GAIN_DB,
  type SoundAssetRef,
  type SoundMapEntry,
} from '@/lib/soundMap';
import {
  applyMusicLifecycleTransition,
  DEFAULT_SOUND_SYSTEM_FLAGS,
  NOOP_MUSIC_HOOKS,
  resolvePlaybackGates,
  shouldPlaySoundEvent,
  type SoundMusicLifecycleHooks,
  type SoundSystemFlags,
} from '@/lib/soundSystem';
import {
  DEFAULT_SOUND_PREFERENCES,
  type SoundEvent,
  type SoundEventName,
  type SoundEventOptions,
  type SoundPreferences,
} from '@/lib/soundTypes';

export const EFFECTS_POOL_SIZE = 6;

/** Minimal player surface used by the pool (matches expo-audio AudioPlayer subset). */
export type SoundPlayer = {
  play(): void;
  pause(): void;
  replace(source: SoundAssetRef): void;
  seekTo(seconds: number): Promise<void> | void;
  release(): void;
  volume: number;
  playing: boolean;
  /** expo-audio loop flag; music engine keeps this false and crossfades instead. */
  loop?: boolean;
};

export type SoundPlayerFactory = (source: SoundAssetRef) => SoundPlayer;

export type SoundEngineOptions = {
  createPlayer: SoundPlayerFactory;
  /** Optional session setup (native). Errors are swallowed. */
  configureSession?: () => void | Promise<void>;
  now?: () => number;
  random?: () => number;
  poolSize?: number;
  /**
   * When true, {@link SoundController.isSoundAvailable} returns true.
   * Web (Sound 8) passes true when AudioContext exists; unlock gating
   * lives in `lib/sound.web.ts`, not here.
   */
  available?: boolean;
  /** Override map lookup (tests). Defaults to {@link getSoundMapEntry}. */
  resolveEntry?: (name: SoundEventName) => SoundMapEntry;
};

export type SoundController = {
  soundEvent: (event: SoundEvent, options?: SoundEventOptions) => void;
  setSoundPreferences: (prefs: SoundPreferences) => void;
  isSoundAvailable: () => boolean;
  getPreferences: () => SoundPreferences;
  /** Test / diagnostics: active pooled players. */
  getPoolSize: () => number;
  /** Test: release all players. */
  reset: () => void;
  /** Sound 7: current system flags (AppState / a11y / interruption). */
  getSystemFlags: () => SoundSystemFlags;
  /** Sound 7: apply system flags and run music lifecycle side effects. */
  applySystemFlags: (next: SoundSystemFlags) => void;
  /**
   * Sound 6 registers real music players here. Until then hooks are no-ops
   * so Sound 7 can still stop the effects pool and gate events.
   */
  registerMusicHooks: (hooks: Partial<SoundMusicLifecycleHooks> | null) => void;
  /** Thin pause/resume/duck surface Sound 6 / tests can call directly. */
  pauseMusic: () => void;
  resumeMusic: (opts?: { fadeIn?: boolean }) => void;
  duckMusic: (volume: number) => void;
  stopAllSound: () => void;
  /** Whether a music bed / layer may start right now. */
  canStartMusic: () => boolean;
};

function clampLadderLevel(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** Pick complexity / laterality ladder module by event payload level/step. */
export function resolveLadderSource(
  event: SoundEvent,
): SoundAssetRef | null {
  if (event.name === 'complexity_changed') {
    const name = `sfx-complexity-${clampLadderLevel(event.level)}` as SoundAssetName;
    return SOUND_ASSETS[name]?.module ?? null;
  }
  if (event.name === 'laterality_step') {
    const name = `sfx-laterality-snap-${clampLadderLevel(event.step)}` as SoundAssetName;
    return SOUND_ASSETS[name]?.module ?? null;
  }
  return null;
}

/**
 * Random entry (laterality 5) → wide land; otherwise leave null so a/b variants pick.
 */
export function resolveReshuffleLandSource(
  event: SoundEvent,
): SoundAssetRef | null {
  if (event.name !== 'reshuffle_landed') return null;
  if (!event.random) return null;
  return SOUND_ASSETS['sfx-reshuffle-land-wide']?.module ?? null;
}

/**
 * Under reduced motion, shorten big-movement SFX: play a fraction, then fade out.
 * Returns a cancel handle (clearTimeout) for tests / reset.
 * Calls `onComplete` when the fade finishes naturally (not on cancel).
 */
export function scheduleReducedMotionFade(
  player: SoundPlayer,
  startVolume: number,
  durationMs: number,
  opts?: {
    playRatio?: number;
    fadeMs?: number;
    setTimeoutFn?: typeof setTimeout;
    clearTimeoutFn?: typeof clearTimeout;
    onComplete?: () => void;
  },
): () => void {
  const playRatio = opts?.playRatio ?? REDUCED_MOTION_SFX_PLAY_RATIO;
  const fadeMs = opts?.fadeMs ?? REDUCED_MOTION_SFX_FADE_MS;
  const setTimeoutFn = opts?.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = opts?.clearTimeoutFn ?? clearTimeout;
  const onComplete = opts?.onComplete;

  const playMs = Math.max(40, Math.floor(durationMs * playRatio));
  const steps = Math.max(2, Math.floor(fadeMs / 20));
  const stepMs = Math.max(10, Math.floor(fadeMs / steps));

  let step = 0;
  let finished = false;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  const playTimer = setTimeoutFn(() => {
    const tick = () => {
      step += 1;
      const t = Math.min(1, step / steps);
      try {
        player.volume = startVolume * (1 - t);
      } catch {
        // ignore
      }
      if (t >= 1) {
        try {
          player.pause();
        } catch {
          // ignore
        }
        fadeTimer = null;
        if (!finished) {
          finished = true;
          onComplete?.();
        }
        return;
      }
      fadeTimer = setTimeoutFn(tick, stepMs);
    };
    tick();
  }, playMs);

  return () => {
    clearTimeoutFn(playTimer);
    if (fadeTimer != null) clearTimeoutFn(fadeTimer);
  };
}

type PoolSlot = {
  player: SoundPlayer;
  lastUsedAt: number;
  eventName: SoundEventName | null;
};

type EventRuntime = {
  lastPlayedAt: number;
  lastVariantIndex: number | null;
  activeVoices: number;
};

/**
 * Pick a random variant index, never repeating the previous index when
 * more than one variant exists.
 */
export function pickVariantIndex(
  count: number,
  lastIndex: number | null,
  random: () => number = Math.random,
): number | null {
  if (count <= 0) return null;
  if (count === 1) return 0;

  if (lastIndex == null || lastIndex < 0 || lastIndex >= count) {
    return Math.floor(random() * count);
  }

  const others = count - 1;
  const offset = Math.floor(random() * others);
  // Map [0, others) onto indices excluding lastIndex.
  return offset >= lastIndex ? offset + 1 : offset;
}

export function isBusEnabled(prefs: SoundPreferences, bus: 'effects' | 'music'): boolean {
  if (!prefs.sound) return false;
  return bus === 'effects' ? prefs.effects : prefs.music;
}

export function createEffectsPool(options: {
  createPlayer: SoundPlayerFactory;
  poolSize?: number;
  now?: () => number;
}) {
  const poolSize = options.poolSize ?? EFFECTS_POOL_SIZE;
  const now = options.now ?? (() => Date.now());
  const slots: PoolSlot[] = [];

  function releaseSlot(index: number): void {
    const slot = slots[index];
    if (!slot) return;
    try {
      slot.player.pause();
    } catch {
      // ignore
    }
    try {
      slot.player.release();
    } catch {
      // ignore
    }
    slots.splice(index, 1);
  }

  function findIdleIndex(): number {
    return slots.findIndex((s) => !s.player.playing);
  }

  function findOldestIndex(): number {
    let oldest = 0;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i]!.lastUsedAt < slots[oldest]!.lastUsedAt) oldest = i;
    }
    return oldest;
  }

  function acquire(source: SoundAssetRef, eventName: SoundEventName): SoundPlayer {
    const idle = findIdleIndex();
    if (idle >= 0) {
      const slot = slots[idle]!;
      slot.player.replace(source);
      slot.lastUsedAt = now();
      slot.eventName = eventName;
      return slot.player;
    }

    if (slots.length < poolSize) {
      const player = options.createPlayer(source);
      slots.push({ player, lastUsedAt: now(), eventName });
      return player;
    }

    // Drop oldest: stop, replace source, reuse.
    const oldest = findOldestIndex();
    const slot = slots[oldest]!;
    try {
      slot.player.pause();
    } catch {
      // ignore
    }
    slot.player.replace(source);
    slot.lastUsedAt = now();
    slot.eventName = eventName;
    return slot.player;
  }

  function countVoices(eventName: SoundEventName): number {
    return slots.filter((s) => s.eventName === eventName && s.player.playing).length;
  }

  function clear(): void {
    for (let i = slots.length - 1; i >= 0; i--) {
      releaseSlot(i);
    }
  }

  function size(): number {
    return slots.length;
  }

  /** Fade music-bus players toward 0 then pause (prefs off). */
  function fadeMusicThenPause(
    isMusic: (name: SoundEventName) => boolean,
    onDone?: () => void,
  ): void {
    const musicSlots = slots.filter((s) => s.eventName != null && isMusic(s.eventName));
    if (musicSlots.length === 0) {
      onDone?.();
      return;
    }
    for (const slot of musicSlots) {
      try {
        slot.player.volume = 0;
        slot.player.pause();
      } catch {
        // ignore
      }
    }
    onDone?.();
  }

  function pauseMatching(isMatch: (name: SoundEventName) => boolean): void {
    for (const slot of slots) {
      if (slot.eventName == null || !isMatch(slot.eventName)) continue;
      try {
        slot.player.pause();
      } catch {
        // ignore
      }
    }
  }

  function setVolumeForBus(
    isBus: (name: SoundEventName) => boolean,
    volume: number,
  ): void {
    for (const slot of slots) {
      if (slot.eventName == null || !isBus(slot.eventName)) continue;
      try {
        slot.player.volume = volume;
      } catch {
        // ignore
      }
    }
  }

  return {
    acquire,
    countVoices,
    clear,
    size,
    fadeMusicThenPause,
    pauseMatching,
    setVolumeForBus,
    slots,
  };
}

export function createSoundController(options: SoundEngineOptions): SoundController {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const available = options.available ?? true;
  const resolveEntry = options.resolveEntry ?? getSoundMapEntry;

  let prefs: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };
  let systemFlags: SoundSystemFlags = { ...DEFAULT_SOUND_SYSTEM_FLAGS };
  let musicHooks: SoundMusicLifecycleHooks = { ...NOOP_MUSIC_HOOKS };
  let sessionReady = false;
  const eventRuntime = new Map<SoundEventName, EventRuntime>();

  const pool = createEffectsPool({
    createPlayer: options.createPlayer,
    poolSize: options.poolSize,
    now,
  });

  function runtimeFor(name: SoundEventName): EventRuntime {
    let rt = eventRuntime.get(name);
    if (!rt) {
      rt = { lastPlayedAt: 0, lastVariantIndex: null, activeVoices: 0 };
      eventRuntime.set(name, rt);
    }
    return rt;
  }

  function gates() {
    return resolvePlaybackGates(prefs, systemFlags);
  }

  async function ensureSession(): Promise<void> {
    if (sessionReady || !options.configureSession) return;
    sessionReady = true;
    try {
      await options.configureSession();
    } catch {
      // Session setup must never break event announce path.
    }
  }

  /** Active RM fade cancels keyed by pooled player (drop on finish / before reuse). */
  const rmFadeByPlayer = new Map<SoundPlayer, () => void>();

  function cancelRmFade(player: SoundPlayer): void {
    const cancel = rmFadeByPlayer.get(player);
    if (!cancel) return;
    try {
      cancel();
    } catch {
      // ignore
    }
    rmFadeByPlayer.delete(player);
  }

  function stopAllSound(): void {
    for (const player of [...rmFadeByPlayer.keys()]) {
      cancelRmFade(player);
    }
    pool.clear();
    try {
      musicHooks.stop();
    } catch {
      // ignore
    }
    try {
      musicHooks.pauseDropIns();
    } catch {
      // ignore
    }
  }

  function playSource(
    source: SoundAssetRef,
    eventName: SoundEventName,
    volume: number,
    reduceMotion: boolean,
  ): boolean {
    if (source == null) return false;
    let player: SoundPlayer;
    try {
      player = pool.acquire(source, eventName);
    } catch {
      return false;
    }

    // Pool reuse: stop any in-flight RM fade on this player before replacing source.
    cancelRmFade(player);

    player.volume = volume;
    // No pitch shift (director decision). Keep rate at unity if exposed later.

    const playSafe = (): void => {
      try {
        player.play();
      } catch {
        // ignore
      }
      if (
        reduceMotion &&
        shouldShortenReducedMotionFade(eventName) &&
        typeof source === 'number'
      ) {
        const durationMs = getSoundAssetDurationMsForModule(source) ?? 400;
        const cancel = scheduleReducedMotionFade(player, volume, durationMs, {
          onComplete: () => {
            rmFadeByPlayer.delete(player);
          },
        });
        rmFadeByPlayer.set(player, cancel);
      }
    };

    try {
      const seek = player.seekTo(0);
      if (seek && typeof (seek as Promise<void>).then === 'function') {
        // Rejection handler avoids unhandled rejection; still attempt play.
        void (seek as Promise<void>).then(playSafe, playSafe);
      } else {
        playSafe();
      }
    } catch {
      playSafe();
    }
    return true;
  }

  function soundEvent(event: SoundEvent, options?: SoundEventOptions): void {
    if (!available) return;
    if (!prefs.sound) return;

    const entry = resolveEntry(event.name);
    if (!isBusEnabled(prefs, entry.bus)) return;

    const currentGates = gates();
    if (!shouldPlaySoundEvent(event.name, entry.bus, currentGates)) return;

    const reduceMotion = Boolean(options?.reduceMotion);
    const ladderSource = resolveLadderSource(event);
    const wideLand = resolveReshuffleLandSource(event);

    let source: SoundAssetRef | null = null;
    let variantIndex: number | null = null;

    if (ladderSource != null) {
      source = ladderSource;
    } else if (wideLand != null) {
      source = wideLand;
    } else {
      const variants = playableVariants(entry);
      if (variants.length === 0) return;
      const rtPreview = runtimeFor(event.name);
      variantIndex = pickVariantIndex(variants.length, rtPreview.lastVariantIndex, random);
      if (variantIndex == null) return;
      source = variants[variantIndex] ?? null;
    }

    if (source == null) return;

    const t = now();
    const rt = runtimeFor(event.name);

    if (entry.minIntervalMs > 0 && t - rt.lastPlayedAt < entry.minIntervalMs) {
      return;
    }

    const playingVoices = pool.countVoices(event.name);
    if (entry.maxVoices > 0 && playingVoices >= entry.maxVoices) {
      return;
    }

    void ensureSession();

    const assetGainDb = 0; // per-file gain lives in authored peaks; map gainDb reserved for music mix
    const busScale =
      entry.bus === 'music' ? currentGates.musicVolume : currentGates.effectsVolume;
    const volume = resolveEventGain(assetGainDb, event.name, reduceMotion) * busScale;
    if (!playSource(source, event.name, volume, reduceMotion)) return;

    rt.lastPlayedAt = t;
    if (variantIndex != null) {
      rt.lastVariantIndex = variantIndex;
    }

    // Optional tone layer under swipe air (QA flag; default off).
    if (
      ENABLE_SWIPE_TONE_LAYERS &&
      (event.name === 'swipe_next' || event.name === 'swipe_back')
    ) {
      const tone = swipeToneModule(event.name);
      const toneVolume =
        resolveEventGain(SWIPE_TONE_LAYER_GAIN_DB, event.name, reduceMotion) * busScale;
      playSource(tone, event.name, toneVolume, reduceMotion);
    }
  }

  function setSoundPreferences(next: SoundPreferences): void {
    const prev = prefs;
    prefs = {
      sound: Boolean(next.sound),
      music: Boolean(next.music),
      effects: Boolean(next.effects),
    };

    const musicWasOn = prev.sound && prev.music;
    const musicNowOff = !prefs.sound || !prefs.music;
    if (musicWasOn && musicNowOff) {
      // Fade, don't cut — immediate volume 0 + pause until a real fader lands with music.
      pool.fadeMusicThenPause((name) => resolveEntry(name).bus === 'music');
      try {
        musicHooks.stop();
        musicHooks.pauseDropIns();
      } catch {
        // ignore
      }
    }
  }

  function applySystemFlags(next: SoundSystemFlags): void {
    const prev = systemFlags;
    systemFlags = {
      appActive: Boolean(next.appActive),
      interrupted: Boolean(next.interrupted),
      screenReaderEnabled: Boolean(next.screenReaderEnabled),
      otherAudioPlaying: Boolean(next.otherAudioPlaying),
      announcementActive: Boolean(next.announcementActive),
    };

    if (prev.appActive && !systemFlags.appActive) {
      // Background: clear effects immediately; music hooks stop via lifecycle.
      for (const player of [...rmFadeByPlayer.keys()]) {
        cancelRmFade(player);
      }
      pool.clear();
    }

    try {
      applyMusicLifecycleTransition(musicHooks, prefs, systemFlags, prev);
    } catch {
      // ignore
    }

    const g = gates();
    pool.setVolumeForBus((name) => resolveEntry(name).bus === 'music', g.musicVolume);
    pool.setVolumeForBus((name) => resolveEntry(name).bus === 'effects', g.effectsVolume);
  }

  function registerMusicHooks(hooks: Partial<SoundMusicLifecycleHooks> | null): void {
    musicHooks = { ...NOOP_MUSIC_HOOKS, ...(hooks ?? {}) };
  }

  function pauseMusic(): void {
    // Music only — effects must keep playing (M3).
    pool.pauseMatching((name) => resolveEntry(name).bus === 'music');
    try {
      musicHooks.pause();
    } catch {
      // ignore
    }
  }

  function resumeMusic(opts: { fadeIn?: boolean } = {}): void {
    try {
      musicHooks.resume({ fadeIn: opts.fadeIn !== false });
    } catch {
      // ignore
    }
  }

  function duckMusic(volume: number): void {
    const level = Math.max(0, Math.min(1, volume));
    pool.setVolumeForBus((name) => resolveEntry(name).bus === 'music', level);
    try {
      musicHooks.duck(level);
    } catch {
      // ignore
    }
  }

  function canStartMusic(): boolean {
    return gates().allowMusicStart;
  }

  function isSoundAvailable(): boolean {
    return available;
  }

  function reset(): void {
    for (const player of [...rmFadeByPlayer.keys()]) {
      cancelRmFade(player);
    }
    pool.clear();
    eventRuntime.clear();
    prefs = { ...DEFAULT_SOUND_PREFERENCES };
    systemFlags = { ...DEFAULT_SOUND_SYSTEM_FLAGS };
    musicHooks = { ...NOOP_MUSIC_HOOKS };
    sessionReady = false;
  }

  return {
    soundEvent,
    setSoundPreferences,
    isSoundAvailable,
    getPreferences: () => ({ ...prefs }),
    getPoolSize: () => pool.size(),
    reset,
    getSystemFlags: () => ({ ...systemFlags }),
    applySystemFlags,
    registerMusicHooks,
    pauseMusic,
    resumeMusic,
    duckMusic,
    stopAllSound,
    canStartMusic,
  };
}
