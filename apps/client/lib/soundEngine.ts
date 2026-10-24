/**
 * Pure sound engine: variant pick, effects pool, anti-stacking, bus prefs.
 * Native `lib/sound.ts` wires expo-audio; tests inject mock players.
 *
 * Pitch shift intentionally omitted (audio director 2026-10-24).
 * Tone layers + reduced-motion gain: Sound 4 (see `lib/soundMap.ts`).
 */

import { SOUND_ASSETS, type SoundAssetName } from '@/lib/soundAssets';
import {
  ENABLE_SWIPE_TONE_LAYERS,
  getSoundMapEntry,
  playableVariants,
  resolveEventGain,
  swipeToneModule,
  SWIPE_TONE_LAYER_GAIN_DB,
  type SoundAssetRef,
  type SoundMapEntry,
} from '@/lib/soundMap';
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
   * Web stubs pass false until Sound 8 unlock path exists.
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

  return { acquire, countVoices, clear, size, fadeMusicThenPause, slots };
}

export function createSoundController(options: SoundEngineOptions): SoundController {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const available = options.available ?? true;
  const resolveEntry = options.resolveEntry ?? getSoundMapEntry;

  let prefs: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };
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

  async function ensureSession(): Promise<void> {
    if (sessionReady || !options.configureSession) return;
    sessionReady = true;
    try {
      await options.configureSession();
    } catch {
      // Session setup must never break event announce path.
    }
  }

  function playSource(
    source: SoundAssetRef,
    eventName: SoundEventName,
    volume: number,
  ): boolean {
    if (source == null) return false;
    let player: SoundPlayer;
    try {
      player = pool.acquire(source, eventName);
    } catch {
      return false;
    }

    player.volume = volume;
    // No pitch shift (director decision). Keep rate at unity if exposed later.

    const playSafe = (): void => {
      try {
        player.play();
      } catch {
        // ignore
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

    const reduceMotion = Boolean(options?.reduceMotion);
    const ladderSource = resolveLadderSource(event);

    let source: SoundAssetRef | null = null;
    let variantIndex: number | null = null;

    if (ladderSource != null) {
      source = ladderSource;
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
    const volume = resolveEventGain(assetGainDb, event.name, reduceMotion);
    if (!playSource(source, event.name, volume)) return;

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
      const toneVolume = resolveEventGain(
        SWIPE_TONE_LAYER_GAIN_DB,
        event.name,
        reduceMotion,
      );
      playSource(tone, event.name, toneVolume);
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
    }
  }

  function isSoundAvailable(): boolean {
    return available;
  }

  function reset(): void {
    pool.clear();
    eventRuntime.clear();
    prefs = { ...DEFAULT_SOUND_PREFERENCES };
    sessionReady = false;
  }

  return {
    soundEvent,
    setSoundPreferences,
    isSoundAvailable,
    getPreferences: () => ({ ...prefs }),
    getPoolSize: () => pool.size(),
    reset,
  };
}
