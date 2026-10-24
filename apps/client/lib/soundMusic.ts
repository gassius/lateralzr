/**
 * Sound 6 generative music engine.
 *
 * Pure scheduling (fake-timer testable) separated from expo-audio players.
 * Loop lengths always come from manifest `durationMs` — never hard-coded.
 * Native has no `loopEnd`; crossfade dual copies at `durationMs - fadeMs`
 * (same AAC-padding idea as Sound 8 web `loopEnd = durationMs / 1000`).
 */

import {
  getSoundAsset,
  getSoundAssetDurationMs,
  type SoundAssetName,
} from '@/lib/soundAssets';
import { gainFromDb, type SoundAssetRef } from '@/lib/soundMap';
import type { SoundEvent } from '@/lib/soundTypes';

/** Layer base × manifest `gainDb` (Sound 9 — same native + web). */
export function musicAssetVolume(asset: SoundAssetName, layerGain = 1): number {
  return layerGain * gainFromDb(getSoundAsset(asset).gainDb);
}

/** Hard cap on simultaneous music players (ticket: 4–5). */
export const MUSIC_MAX_PLAYERS = 5;

/** All music transitions fade; never hard-cut. */
export const MUSIC_FADE_MIN_MS = 3000;
export const MUSIC_FADE_MAX_MS = 8000;
/** Default crossfade / layer fade length (within 3–8 s). */
export const MUSIC_FADE_MS = 4000;
/** Discovery duck return (~2 s). */
export const MUSIC_DISCOVERY_RETURN_MS = 2000;
export const MUSIC_DISCOVERY_DUCK_GAIN = 0.35;

export const MUSIC_DROPIN_MIN_MS = 20_000;
export const MUSIC_DROPIN_MAX_MS = 60_000;
/** Idle = no gesture/commit for this long before drop-ins may fire. */
export const MUSIC_GESTURE_IDLE_MS = 3000;

export const MUSIC_BED_CALM: SoundAssetName = 'music-bed-calm-a';
export const MUSIC_BED_BRIGHT: SoundAssetName = 'music-bed-bright-b';
export const MUSIC_INTRO_LOOP: SoundAssetName = 'music-intro-loop';

export const MUSIC_TEXTURES = [
  'music-texture-shimmer-a',
  'music-texture-subswell-b',
  'music-texture-tonedrift-c',
  'music-texture-air-d',
] as const satisfies readonly SoundAssetName[];

/** Ticket drop-ins 01..08 (kit may ship more; engine only uses this set). */
export const MUSIC_DROPINS = [
  'music-dropin-01',
  'music-dropin-02',
  'music-dropin-03',
  'music-dropin-04',
  'music-dropin-05',
  'music-dropin-06',
  'music-dropin-07',
  'music-dropin-08',
] as const satisfies readonly SoundAssetName[];

export type MusicPlayer = {
  play(): void;
  pause(): void;
  replace(source: SoundAssetRef): void;
  seekTo(seconds: number): Promise<void> | void;
  release(): void;
  volume: number;
  playing: boolean;
  /** Native expo-audio loop flag — engine keeps this false; we crossfade. */
  loop?: boolean;
};

export type MusicPlayerFactory = (source: SoundAssetRef) => MusicPlayer;

export type MusicEngineOptions = {
  createPlayer: MusicPlayerFactory;
  /** Resolve asset module id for a named kit entry. */
  resolveModule: (name: SoundAssetName) => SoundAssetRef;
  /** Manifest duration — never hard-code loop lengths. */
  getDurationMs?: (name: SoundAssetName) => number;
  now?: () => number;
  random?: () => number;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
  /** Gate bed / layer starts (Sound 7 other-audio / prefs). */
  canStartMusic?: () => boolean;
  /** When true, drop-ins stay paused (screen reader / announcement). */
  areDropInsBlocked?: () => boolean;
  maxPlayers?: number;
  fadeMs?: number;
};

export type MusicFadeRecord = {
  at: number;
  from: number;
  to: number;
  durationMs: number;
  asset: SoundAssetName | null;
};

export type MusicEngine = {
  handleEvent: (event: SoundEvent) => void;
  setEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setProgressInputs: (complexity: number, lateralityStep: number) => void;
  setRandomEntry: (random: boolean) => void;
  noteGesture: () => void;
  pause: () => void;
  resume: (opts: { fadeIn: boolean }) => void;
  duck: (volume: number) => void;
  stop: () => void;
  restartBed: (opts: { fadeIn: boolean }) => void;
  pauseDropIns: () => void;
  resumeDropIns: () => void;
  /** Diagnostics / tests. */
  getActivePlayerCount: () => number;
  getFades: () => readonly MusicFadeRecord[];
  getActiveTextures: () => readonly SoundAssetName[];
  getBedAsset: () => SoundAssetName | null;
  getLastDropIn: () => SoundAssetName | null;
  getProgress: () => number;
  getPhase: () => MusicPhase;
  /** Test helper: attempt one drop-in immediately (still respects idle / blocks). */
  tryDropInNow: () => void;
  reset: () => void;
};

export type MusicPhase = 'idle' | 'intro' | 'bed' | 'stopped';

type SlotKind = 'intro' | 'bed' | 'texture' | 'arrival' | 'dropin';

type PlayerSlot = {
  id: number;
  player: MusicPlayer;
  asset: SoundAssetName;
  kind: SlotKind;
  /** Target gain before duck / master multipliers. */
  targetVolume: number;
  /** Sister slot during a loop crossfade (other copy). */
  pairId: number | null;
  /** Fading out toward release — syncBed / resume skip these. */
  stopping: boolean;
  /** Bumped to cancel an in-flight fadeSlot. */
  fadeGeneration: number;
  /** Wall-clock when this copy started (seek 0) — for pause/resume lead. */
  loopAnchorAt: number;
  /** Pending crossfade schedule for this copy. */
  loopTimerId: TimerId | null;
};

type TimerId = ReturnType<typeof setTimeout>;

export function clampFadeMs(ms: number): number {
  return Math.max(MUSIC_FADE_MIN_MS, Math.min(MUSIC_FADE_MAX_MS, ms));
}

/**
 * Smoothed 0..1 progress from Complexity (1–5) and Laterality step (1–5).
 * Equal weight; out-of-range values clamp.
 */
export function computeMusicProgress(complexity: number, lateralityStep: number): number {
  const c = Math.max(1, Math.min(5, complexity));
  const l = Math.max(1, Math.min(5, lateralityStep));
  return 0.5 * ((c - 1) / 4) + 0.5 * ((l - 1) / 4);
}

/**
 * How many textures may be present for a progress value.
 * Low → bed only; high → bed + layers; air-d only at max tier.
 * Reduced Motion caps at 1.
 */
export function textureCountForProgress(progress: number, reduceMotion: boolean): number {
  const p = Math.max(0, Math.min(1, progress));
  let n = 0;
  if (p >= 0.25) n = 1;
  if (p >= 0.5) n = 2;
  if (p >= 0.75) n = 3;
  if (p >= 0.9) n = 4;
  if (reduceMotion) n = Math.min(n, 1);
  return n;
}

/** Allowed texture assets for the current progress tier (air-d only at max). */
export function texturesForProgress(
  progress: number,
  reduceMotion: boolean,
): readonly SoundAssetName[] {
  const n = textureCountForProgress(progress, reduceMotion);
  return MUSIC_TEXTURES.slice(0, n);
}

export function bedAssetForProgress(
  progress: number,
  randomEntry: boolean,
): SoundAssetName {
  if (randomEntry || progress >= 0.55) return MUSIC_BED_BRIGHT;
  return MUSIC_BED_CALM;
}

/** Seconds for native / web loop end from manifest ms (AAC padding). */
export function loopEndSecondsFromDurationMs(durationMs: number): number {
  return Math.max(0, durationMs) / 1000;
}

function isGestureEvent(name: SoundEvent['name']): boolean {
  return (
    name === 'card_flip' ||
    name === 'card_flip_back' ||
    name === 'swipe_next' ||
    name === 'swipe_back' ||
    name === 'swipe_cancel' ||
    name === 'swipe_resistance' ||
    name === 'reshuffle_started' ||
    name === 'card_arrived'
  );
}

export function createSoundMusicEngine(options: MusicEngineOptions): MusicEngine {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout ?? ((id) => clearTimeout(id));
  const getDurationMs = options.getDurationMs ?? getSoundAssetDurationMs;
  const maxPlayers = options.maxPlayers ?? MUSIC_MAX_PLAYERS;
  const fadeMs = clampFadeMs(options.fadeMs ?? MUSIC_FADE_MS);
  const canStart = options.canStartMusic ?? (() => true);
  const dropInsBlocked = options.areDropInsBlocked ?? (() => false);

  let nextSlotId = 1;
  const slots = new Map<number, PlayerSlot>();
  const timers = new Set<TimerId>();
  const fades: MusicFadeRecord[] = [];

  let enabled = true;
  let reduceMotion = false;
  let complexity = 3;
  let lateralityStep = 3;
  let randomEntry = false;
  let progress = computeMusicProgress(complexity, lateralityStep);
  let phase: MusicPhase = 'idle';
  let paused = false;
  let duckGain = 1;
  let discoveryDuck = 1;
  let dropInsPaused = false;
  let lastGestureAt = 0;
  let lastDropIn: SoundAssetName | null = null;
  let bedAsset: SoundAssetName | null = null;
  let dropInTimer: TimerId | null = null;
  let textureRotateTimer: TimerId | null = null;
  let discoveryTimer: TimerId | null = null;
  /** Wall-clock when pause() began — resume shifts loopAnchorAt by this span. */
  let pausedAt: number | null = null;

  function schedule(fn: () => void, ms: number): TimerId {
    const id = setTimer(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearScheduled(id: TimerId | null): void {
    if (id == null) return;
    clearTimer(id);
    timers.delete(id);
  }

  function clearAllTimers(): void {
    for (const id of [...timers]) {
      clearTimer(id);
    }
    timers.clear();
    dropInTimer = null;
    textureRotateTimer = null;
    discoveryTimer = null;
  }

  function effectiveVolume(target: number): number {
    return Math.max(0, Math.min(1, target * duckGain * discoveryDuck));
  }

  function recordFade(
    slot: PlayerSlot,
    from: number,
    to: number,
    durationMs: number,
  ): void {
    fades.push({
      at: now(),
      from,
      to,
      durationMs,
      asset: slot.asset,
    });
  }

  function applyVolume(slot: PlayerSlot, volume: number): void {
    try {
      slot.player.volume = volume;
    } catch {
      // ignore
    }
  }

  /** Cancel any in-flight fade on this slot (B2 — new fade wins). */
  function cancelFade(slot: PlayerSlot): void {
    slot.fadeGeneration += 1;
  }

  /**
   * Linear fade via timer steps. Always records a fade (never a hard cut).
   * Zero-duration still records a fade for audit, then snaps.
   * A later fadeSlot / cancelFade bumps fadeGeneration so older ticks no-op.
   */
  function fadeSlot(
    slot: PlayerSlot,
    toTarget: number,
    durationMs: number,
    onDone?: () => void,
  ): void {
    cancelFade(slot);
    const gen = slot.fadeGeneration;
    const to = effectiveVolume(toTarget);
    const from = slot.player.volume;
    const dur = Math.max(0, durationMs);
    recordFade(slot, from, to, dur);
    slot.targetVolume = toTarget;

    if (dur <= 0 || from === to) {
      applyVolume(slot, to);
      if (slot.fadeGeneration === gen && slots.has(slot.id)) onDone?.();
      return;
    }

    const steps = Math.max(4, Math.round(dur / 50));
    const stepMs = dur / steps;
    let i = 0;
    const tick = (): void => {
      if (slot.fadeGeneration !== gen || !slots.has(slot.id)) return;
      i += 1;
      const t = i / steps;
      applyVolume(slot, from + (to - from) * t);
      if (i >= steps) {
        applyVolume(slot, to);
        onDone?.();
        return;
      }
      schedule(tick, stepMs);
    };
    schedule(tick, stepMs);
  }

  function releaseSlot(id: number): void {
    const slot = slots.get(id);
    if (!slot) return;
    cancelFade(slot);
    if (slot.loopTimerId != null) {
      clearScheduled(slot.loopTimerId);
      slot.loopTimerId = null;
    }
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
    slots.delete(id);
  }

  function activeCount(): number {
    return slots.size;
  }

  function ensureBudget(need: number): void {
    // Free stopping slots first so a quick restartBed is not blocked by fade-outs.
    for (const slot of [...slots.values()]) {
      if (activeCount() + need <= maxPlayers) break;
      if (slot.stopping) releaseSlot(slot.id);
    }
    while (activeCount() + need > maxPlayers) {
      // Drop lowest-priority: dropin → texture → arrival → bed pair idle → intro
      const dropin = [...slots.values()].find((s) => s.kind === 'dropin');
      if (dropin) {
        releaseSlot(dropin.id);
        continue;
      }
      const texture = [...slots.values()].find((s) => s.kind === 'texture');
      if (texture) {
        releaseSlot(texture.id);
        continue;
      }
      const arrival = [...slots.values()].find((s) => s.kind === 'arrival');
      if (arrival) {
        releaseSlot(arrival.id);
        continue;
      }
      break;
    }
  }

  function createSlot(
    asset: SoundAssetName,
    kind: SlotKind,
    targetVolume: number,
  ): PlayerSlot | null {
    const moduleId = options.resolveModule(asset);
    if (moduleId == null) return null;
    ensureBudget(1);
    if (activeCount() >= maxPlayers) return null;

    let player: MusicPlayer;
    try {
      player = options.createPlayer(moduleId);
    } catch {
      return null;
    }
    if (player.loop != null) player.loop = false;

    const slot: PlayerSlot = {
      id: nextSlotId++,
      player,
      asset,
      kind,
      targetVolume,
      pairId: null,
      stopping: false,
      fadeGeneration: 0,
      loopAnchorAt: now(),
      loopTimerId: null,
    };
    slots.set(slot.id, slot);
    applyVolume(slot, 0);
    try {
      const seek = player.seekTo(0);
      const playSafe = (): void => {
        try {
          player.play();
        } catch {
          // ignore
        }
      };
      if (seek && typeof (seek as Promise<void>).then === 'function') {
        void (seek as Promise<void>).then(playSafe, playSafe);
      } else {
        playSafe();
      }
    } catch {
      try {
        player.play();
      } catch {
        // ignore
      }
    }
    return slot;
  }

  /**
   * Schedule seamless loop via dual-copy crossfade keyed off manifest durationMs.
   * B1: arm the next loop as soon as copy B is created (not after its fade-in),
   * so later loops still overlap instead of fading over silence.
   */
  function scheduleCrossfadeLoop(primary: PlayerSlot): void {
    if (primary.stopping || primary.loopTimerId != null) return;
    const durationMs = getDurationMs(primary.asset);
    const elapsed = Math.max(0, now() - primary.loopAnchorAt);
    const leadMs = Math.max(0, durationMs - fadeMs - elapsed);

    primary.loopTimerId = schedule(() => {
      primary.loopTimerId = null;
      if (!slots.has(primary.id) || primary.stopping || paused || !enabled) return;
      if (phase === 'stopped') return;

      ensureBudget(1);
      const secondary = createSlot(primary.asset, primary.kind, primary.targetVolume);
      if (!secondary) {
        // Retry next loop length — still duration-driven.
        scheduleCrossfadeLoop(primary);
        return;
      }
      primary.pairId = secondary.id;
      secondary.pairId = primary.id;

      primary.stopping = true;
      fadeSlot(primary, 0, fadeMs, () => {
        if (slots.has(primary.id)) releaseSlot(primary.id);
      });
      fadeSlot(secondary, secondary.targetVolume, fadeMs);
      // Arm B's next crossfade immediately (B1) — do not wait for fade-in.
      scheduleCrossfadeLoop(secondary);
    }, leadMs);
  }

  function slotsOfKind(kind: SlotKind): PlayerSlot[] {
    return [...slots.values()].filter((s) => s.kind === kind);
  }

  function stopKind(kind: SlotKind, fadeOutMs: number): void {
    for (const slot of slotsOfKind(kind)) {
      if (slot.stopping) continue;
      slot.stopping = true;
      if (slot.loopTimerId != null) {
        clearScheduled(slot.loopTimerId);
        slot.loopTimerId = null;
      }
      fadeSlot(slot, 0, fadeOutMs, () => {
        if (slots.has(slot.id)) releaseSlot(slot.id);
      });
    }
  }

  function startIntro(): void {
    if (!enabled || !canStart()) return;
    phase = 'intro';
    stopKind('intro', fadeMs);
    const introVol = musicAssetVolume(MUSIC_INTRO_LOOP, 1);
    const slot = createSlot(MUSIC_INTRO_LOOP, 'intro', introVol);
    if (!slot) return;
    fadeSlot(slot, introVol, fadeMs);
    scheduleCrossfadeLoop(slot);
    // Background-load hint: warm bed module (no play yet).
    void options.resolveModule(bedAssetForProgress(progress, randomEntry));
  }

  function startArrivalAndBed(): void {
    if (!enabled || !canStart()) return;

    // Arrival one-shot (variant a/b).
    const arrivalName: SoundAssetName =
      random() < 0.5 ? 'music-intro-arrival-a' : 'music-intro-arrival-b';
    const arrivalVol = musicAssetVolume(arrivalName, 1);
    const arrival = createSlot(arrivalName, 'arrival', arrivalVol);
    if (arrival) {
      fadeSlot(arrival, arrivalVol, Math.min(fadeMs, MUSIC_FADE_MIN_MS));
      const arrivalDur = getDurationMs(arrivalName);
      const arrivalId = arrival.id;
      schedule(() => {
        const slot = slots.get(arrivalId);
        if (!slot || slot.stopping) return;
        slot.stopping = true;
        fadeSlot(slot, 0, MUSIC_FADE_MIN_MS, () => {
          if (slots.has(arrivalId)) releaseSlot(arrivalId);
        });
      }, Math.max(0, arrivalDur - MUSIC_FADE_MIN_MS));
    }

    // Intro pad keeps going and crossfades into bed (no hard stop).
    const nextBed = bedAssetForProgress(progress, randomEntry);
    bedAsset = nextBed;
    const bedVol = musicAssetVolume(nextBed, 1);
    const bed = createSlot(nextBed, 'bed', bedVol);
    if (bed) {
      fadeSlot(bed, bedVol, fadeMs);
      scheduleCrossfadeLoop(bed);
    }
    // Fade intro out while bed comes in.
    for (const intro of slotsOfKind('intro')) {
      if (intro.stopping) continue;
      intro.stopping = true;
      if (intro.loopTimerId != null) {
        clearScheduled(intro.loopTimerId);
        intro.loopTimerId = null;
      }
      fadeSlot(intro, 0, fadeMs, () => {
        if (slots.has(intro.id)) releaseSlot(intro.id);
      });
    }
    phase = 'bed';
    syncTextures();
    scheduleDropIn();
    scheduleTextureRotate();
  }

  function syncBed(fadeIn: boolean): void {
    if (!enabled || !canStart() || phase === 'intro') return;
    const next = bedAssetForProgress(progress, randomEntry);
    // Skip beds already fading out (B2) — don't treat them as the live bed.
    const current = slotsOfKind('bed').find((s) => !s.stopping);
    if (current && current.asset === next) {
      bedAsset = next;
      return;
    }
    bedAsset = next;
    for (const slot of slotsOfKind('bed')) {
      if (slot.stopping) continue;
      slot.stopping = true;
      if (slot.loopTimerId != null) {
        clearScheduled(slot.loopTimerId);
        slot.loopTimerId = null;
      }
      fadeSlot(slot, 0, fadeMs, () => {
        if (slots.has(slot.id)) releaseSlot(slot.id);
      });
    }
    const bedVol = musicAssetVolume(next, 1);
    const bed = createSlot(next, 'bed', bedVol);
    if (!bed) return;
    if (fadeIn) {
      fadeSlot(bed, bedVol, fadeMs);
    } else {
      // M2: fadeIn false → snap to target (still recorded as a 0-ms fade).
      fadeSlot(bed, bedVol, 0);
    }
    scheduleCrossfadeLoop(bed);
    phase = 'bed';
  }

  function syncTextures(): void {
    if (phase !== 'bed' || !enabled || paused) return;
    const allowed = new Set(texturesForProgress(progress, reduceMotion));
    for (const slot of slotsOfKind('texture')) {
      if (slot.stopping || allowed.has(slot.asset)) continue;
      slot.stopping = true;
      if (slot.loopTimerId != null) {
        clearScheduled(slot.loopTimerId);
        slot.loopTimerId = null;
      }
      fadeSlot(slot, 0, fadeMs, () => {
        if (slots.has(slot.id)) releaseSlot(slot.id);
      });
    }
    const present = new Set(
      slotsOfKind('texture')
        .filter((s) => !s.stopping)
        .map((s) => s.asset),
    );
    const missing = [...allowed].filter((a) => !present.has(a));
    // Fill up to allowed count, respecting player budget (leave room for bed pair + drop-in).
    const room = Math.max(0, maxPlayers - activeCount() - 1);
    for (const asset of missing.slice(0, room)) {
      const texVol = musicAssetVolume(asset, 0.7);
      const slot = createSlot(asset, 'texture', texVol);
      if (!slot) break;
      fadeSlot(slot, texVol, fadeMs);
      scheduleCrossfadeLoop(slot);
    }
  }

  function scheduleTextureRotate(): void {
    clearScheduled(textureRotateTimer);
    textureRotateTimer = null;
    if (phase !== 'bed' || !enabled || reduceMotion) return;
    const allowed = texturesForProgress(progress, reduceMotion);
    if (allowed.length <= 1) return;

    const delay = 8000 + random() * 12000;
    textureRotateTimer = schedule(() => {
      textureRotateTimer = null;
      if (phase !== 'bed' || paused) return;
      const present = slotsOfKind('texture').filter((s) => !s.stopping);
      // Fade one out / one in within allowed set.
      if (present.length > 0 && random() < 0.6) {
        const victim = present[Math.floor(random() * present.length)]!;
        victim.stopping = true;
        if (victim.loopTimerId != null) {
          clearScheduled(victim.loopTimerId);
          victim.loopTimerId = null;
        }
        fadeSlot(victim, 0, fadeMs, () => {
          if (slots.has(victim.id)) releaseSlot(victim.id);
        });
      }
      syncTextures();
      scheduleTextureRotate();
    }, delay);
  }

  function scheduleDropIn(): void {
    clearScheduled(dropInTimer);
    dropInTimer = null;
    if (phase !== 'bed' || !enabled || dropInsPaused) return;

    const delay =
      MUSIC_DROPIN_MIN_MS + random() * (MUSIC_DROPIN_MAX_MS - MUSIC_DROPIN_MIN_MS);
    dropInTimer = schedule(() => {
      dropInTimer = null;
      tryPlayDropIn();
      scheduleDropIn();
    }, delay);
  }

  function tryPlayDropIn(): void {
    if (!enabled || paused || dropInsPaused || phase !== 'bed') return;
    if (dropInsBlocked()) return;
    if (now() - lastGestureAt < MUSIC_GESTURE_IDLE_MS) return;
    if (!canStart()) return;

    const candidates = MUSIC_DROPINS.filter((d) => d !== lastDropIn);
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(random() * candidates.length)]!;
    lastDropIn = pick;

    ensureBudget(1);
    const dropVol = musicAssetVolume(pick, 0.85);
    const slot = createSlot(pick, 'dropin', dropVol);
    if (!slot) return;
    fadeSlot(slot, dropVol, Math.min(fadeMs, MUSIC_FADE_MIN_MS));
    const dur = getDurationMs(pick);
    const dropId = slot.id;
    schedule(() => {
      const live = slots.get(dropId);
      if (!live || live.stopping) return;
      live.stopping = true;
      fadeSlot(live, 0, MUSIC_FADE_MIN_MS, () => {
        if (slots.has(dropId)) releaseSlot(dropId);
      });
    }, Math.max(0, dur - MUSIC_FADE_MIN_MS));
  }

  function onDiscoveryLanded(): void {
    discoveryDuck = MUSIC_DISCOVERY_DUCK_GAIN;
    // Thin: fade textures out; duck bed gain.
    for (const slot of slotsOfKind('texture')) {
      if (slot.stopping) continue;
      slot.stopping = true;
      if (slot.loopTimerId != null) {
        clearScheduled(slot.loopTimerId);
        slot.loopTimerId = null;
      }
      fadeSlot(slot, 0, MUSIC_DISCOVERY_RETURN_MS, () => {
        if (slots.has(slot.id)) releaseSlot(slot.id);
      });
    }
    for (const slot of slotsOfKind('bed')) {
      if (slot.stopping) continue;
      fadeSlot(slot, slot.targetVolume, MUSIC_DISCOVERY_RETURN_MS);
    }
    clearScheduled(discoveryTimer);
    discoveryTimer = schedule(() => {
      discoveryTimer = null;
      discoveryDuck = 1;
      for (const slot of [...slots.values()]) {
        if (slot.stopping || !slots.has(slot.id)) continue;
        fadeSlot(slot, slot.targetVolume, MUSIC_DISCOVERY_RETURN_MS);
      }
      syncTextures();
    }, MUSIC_DISCOVERY_RETURN_MS);
  }

  function recomputeProgress(): void {
    progress = computeMusicProgress(complexity, lateralityStep);
    if (phase === 'bed') {
      syncBed(true);
      syncTextures();
    }
  }

  function handleEvent(event: SoundEvent): void {
    if (isGestureEvent(event.name)) {
      lastGestureAt = now();
    }

    switch (event.name) {
      case 'intro_started':
        startIntro();
        break;
      case 'intro_ready':
        startArrivalAndBed();
        break;
      case 'complexity_changed':
        complexity = event.level;
        recomputeProgress();
        break;
      case 'laterality_step':
        lateralityStep = event.step;
        recomputeProgress();
        break;
      case 'reshuffle_started':
        randomEntry = Boolean(event.random);
        lastGestureAt = now();
        break;
      case 'reshuffle_landed':
        randomEntry = Boolean(event.random);
        lastGestureAt = now();
        if (event.random) syncBed(true);
        onDiscoveryLanded();
        break;
      default:
        break;
    }
  }

  function setEnabled(next: boolean): void {
    const was = enabled;
    enabled = next;
    if (was && !next) {
      stop();
    } else if (!was && next && canStart()) {
      restartBed({ fadeIn: true });
    }
  }

  function setReducedMotion(next: boolean): void {
    reduceMotion = next;
    if (phase === 'bed') syncTextures();
  }

  function setProgressInputs(c: number, l: number): void {
    complexity = c;
    lateralityStep = l;
    recomputeProgress();
  }

  function setRandomEntry(next: boolean): void {
    randomEntry = next;
    if (phase === 'bed') syncBed(true);
  }

  function noteGesture(): void {
    lastGestureAt = now();
  }

  function pause(): void {
    if (paused) return;
    paused = true;
    pausedAt = now();
    // B3: clear loop / drop-in / texture / discovery / fade / one-shot end timers.
    clearAllTimers();
    for (const slot of [...slots.values()]) {
      slot.loopTimerId = null;
      // Fade-out onDone releases were cancelled with the timers — finish now.
      if (slot.stopping) {
        releaseSlot(slot.id);
        continue;
      }
      // Arrival / drop-in end timers were cancelled — free so they neither
      // leak nor replay on resume (one-shots are not re-armed).
      if (slot.kind === 'arrival' || slot.kind === 'dropin') {
        releaseSlot(slot.id);
        continue;
      }
      try {
        slot.player.pause();
      } catch {
        // ignore
      }
    }
  }

  function resume(opts: { fadeIn: boolean }): void {
    // Shift loop anchors by paused wall time so elapsed ignores the pause
    // (otherwise a long pause makes the next crossfade fire immediately).
    const pauseMs = pausedAt != null ? Math.max(0, now() - pausedAt) : 0;
    if (!enabled || !canStart()) return;
    // Clear after the guard so an early return keeps pausedAt for a later resume.
    pausedAt = null;
    paused = false;

    // Pause may interrupt a dual-copy crossfade with two live slots of the same
    // kind+asset (A not yet marked stopping, B already playing). Keep one;
    // release the rest so we do not double-schedule loops or blow the player cap.
    const seen = new Set<string>();
    for (const slot of [...slots.values()]) {
      if (slot.stopping) {
        // Should already be gone after pause; belt-and-suspenders.
        releaseSlot(slot.id);
        continue;
      }
      if (slot.kind === 'arrival' || slot.kind === 'dropin') {
        // One-shot end timers were cleared on pause and not re-armed — free now.
        releaseSlot(slot.id);
        continue;
      }
      const key = `${slot.kind}:${slot.asset}`;
      if (seen.has(key)) {
        releaseSlot(slot.id);
        continue;
      }
      seen.add(key);
    }

    for (const slot of slots.values()) {
      slot.loopAnchorAt += pauseMs;
      try {
        slot.player.play();
      } catch {
        // ignore
      }
      if (opts.fadeIn) {
        applyVolume(slot, 0);
        fadeSlot(slot, slot.targetVolume, fadeMs);
      } else {
        // M2: snap when fadeIn is false.
        fadeSlot(slot, slot.targetVolume, 0);
      }
    }

    // B3: re-arm crossfade / drop-ins / texture rotate from remaining lead.
    for (const slot of slots.values()) {
      if (slot.kind === 'intro' || slot.kind === 'bed' || slot.kind === 'texture') {
        scheduleCrossfadeLoop(slot);
      }
    }
    if (phase === 'bed') {
      if (!dropInsPaused) scheduleDropIn();
      scheduleTextureRotate();
    }
  }

  function duck(volume: number): void {
    duckGain = Math.max(0, Math.min(1, volume));
    for (const slot of slots.values()) {
      if (slot.stopping) continue;
      fadeSlot(slot, slot.targetVolume, Math.min(fadeMs, MUSIC_FADE_MIN_MS));
    }
  }

  function stop(): void {
    phase = 'stopped';
    clearAllTimers();
    for (const slot of slots.values()) {
      slot.loopTimerId = null;
    }
    // B2: only the players present at stop — not ones restartBed creates after.
    const idsAtStop = [...slots.keys()];
    for (const id of idsAtStop) {
      const slot = slots.get(id);
      if (!slot) continue;
      slot.stopping = true;
      fadeSlot(slot, 0, fadeMs, () => {
        if (slots.has(id)) releaseSlot(id);
      });
    }
    schedule(() => {
      for (const id of idsAtStop) {
        if (slots.has(id)) releaseSlot(id);
      }
    }, fadeMs + 10);
  }

  function restartBed(opts: { fadeIn: boolean }): void {
    if (!enabled || !canStart()) return;
    paused = false;
    pausedAt = null;
    phase = 'bed';
    // Clear non-bed leftovers (fade out; cancel prior fades via fadeGeneration).
    for (const slot of [...slots.values()]) {
      if (slot.kind === 'bed' || slot.stopping) continue;
      slot.stopping = true;
      if (slot.loopTimerId != null) {
        clearScheduled(slot.loopTimerId);
        slot.loopTimerId = null;
      }
      fadeSlot(slot, 0, fadeMs, () => {
        if (slots.has(slot.id)) releaseSlot(slot.id);
      });
    }
    syncBed(opts.fadeIn);
    syncTextures();
    if (!dropInsPaused) scheduleDropIn();
    scheduleTextureRotate();
  }

  function pauseDropIns(): void {
    dropInsPaused = true;
    clearScheduled(dropInTimer);
    dropInTimer = null;
    stopKind('dropin', MUSIC_FADE_MIN_MS);
  }

  function resumeDropIns(): void {
    dropInsPaused = false;
    if (phase === 'bed') scheduleDropIn();
  }

  function reset(): void {
    clearAllTimers();
    for (const id of [...slots.keys()]) releaseSlot(id);
    fades.length = 0;
    enabled = true;
    reduceMotion = false;
    complexity = 3;
    lateralityStep = 3;
    randomEntry = false;
    progress = computeMusicProgress(3, 3);
    phase = 'idle';
    paused = false;
    pausedAt = null;
    duckGain = 1;
    discoveryDuck = 1;
    dropInsPaused = false;
    lastGestureAt = 0;
    lastDropIn = null;
    bedAsset = null;
  }

  return {
    handleEvent,
    setEnabled,
    setReducedMotion,
    setProgressInputs,
    setRandomEntry,
    noteGesture,
    pause,
    resume,
    duck,
    stop,
    restartBed,
    pauseDropIns,
    resumeDropIns,
    getActivePlayerCount: activeCount,
    getFades: () => fades,
    getActiveTextures: () =>
      [...new Set(slotsOfKind('texture').map((s) => s.asset))] as SoundAssetName[],
    getBedAsset: () => bedAsset,
    getLastDropIn: () => lastDropIn,
    getProgress: () => progress,
    getPhase: () => phase,
    tryDropInNow: () => tryPlayDropIn(),
    reset,
  };
}
