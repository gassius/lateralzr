/**
 * Adaptive layer player group — shared clock, gain-only muting.
 *
 * Native: expo-audio players started in one JS tick; re-aligned to master at
 * every loop boundary (no loopEnd / sample-accurate scheduler). Colour is
 * gain + arp/arp-bright swap only (same as web preview).
 *
 * Web: platforms pass a custom {@link LayerGainSink} with Web Audio fades.
 */

import { getSoundAsset, type SoundAssetName } from '@/lib/soundAssets';
import {
  createLayerScheduler,
  LAZY_LAYER_ROLES,
  LAYER_ASSET_BY_ROLE,
  LAYER_LOOP_SECONDS,
  LAYER_ROLES,
  loopPhaseOffsetSeconds,
  type LayerRole,
  type LayerScheduler,
  type LayerSchedulerOptions,
} from '@/lib/soundLayers';
import type { SoundAssetRef } from '@/lib/soundMap';
import { soundWarn } from '@/lib/soundWarn';

export type LayerAudioPlayer = {
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void> | void;
  release(): void;
  volume: number;
  playing: boolean;
  loop?: boolean;
};

export type LayerPlayerFactory = (source: SoundAssetRef) => LayerAudioPlayer;

export type DriftSample = {
  /** Wall ms since layer group start. */
  elapsedMs: number;
  /** Max |playerPos − masterPos| across running layers (seconds). */
  maxDriftSeconds: number;
  masterPhaseSeconds: number;
};

export type AdaptiveLayerGroup = {
  scheduler: LayerScheduler;
  /** Ensure pad (and any already-warmed) players exist and share t0. */
  ensureStarted: () => void;
  /** Decode/create one lazy role; marks scheduler loaded when ready. */
  loadRole: (role: LayerRole) => Promise<void>;
  /** Background-load roles 2–5 sequentially after first card. */
  startLazyLoads: () => void;
  setEnabled: (enabled: boolean) => void;
  setProgress: (complexity: number, laterality: number) => void;
  setMasterGain: (gain: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Measure drift vs master phase (native AC 4). */
  sampleDrift: () => DriftSample | null;
  getDriftLog: () => readonly DriftSample[];
  /** Test / diagnostics. */
  getPlayerCount: () => number;
  isRoleReady: (role: LayerRole) => boolean;
};

export type AdaptiveLayerGroupOptions = {
  createPlayer: LayerPlayerFactory;
  resolveModule?: (name: SoundAssetName) => SoundAssetRef;
  schedulerOptions?: Omit<LayerSchedulerOptions, 'sink'>;
  /** Optional Web Audio equal-power fade. */
  fadeGains?: LayerSchedulerOptions['sink']['fadeGains'];
  /** Read current playback position (seconds) for drift / realign. */
  getPositionSeconds?: (player: LayerAudioPlayer) => number | null;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
  /** When true, schedule loop-boundary re-align (native). Default true. */
  reAlignOnLoop?: boolean;
};

export function createAdaptiveLayerGroup(
  options: AdaptiveLayerGroupOptions,
): AdaptiveLayerGroup {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout ?? ((id) => clearTimeout(id));
  const resolve =
    options.resolveModule ?? ((name: SoundAssetName) => getSoundAsset(name).module);
  const reAlignOnLoop = options.reAlignOnLoop !== false;

  const players = new Map<LayerRole, LayerAudioPlayer>();
  const ready = new Set<LayerRole>();
  let masterGain = 1;
  let enabled = true;
  let started = false;
  let wallT0Ms: number | null = null;
  let alignTimer: ReturnType<typeof setTimeout> | null = null;
  let lazyStarted = false;
  const driftLog: DriftSample[] = [];
  let pendingGains: Record<LayerRole, number> = Object.fromEntries(
    LAYER_ROLES.map((r) => [r, 0]),
  ) as Record<LayerRole, number>;

  function applyVolumes(): void {
    for (const role of LAYER_ROLES) {
      const player = players.get(role);
      if (!player) continue;
      try {
        player.volume = pendingGains[role]! * masterGain;
      } catch (err) {
        soundWarn('layer volume', err);
      }
    }
  }

  const scheduler = createLayerScheduler({
    ...(options.schedulerOptions ?? {}),
    now,
    setTimeout: setTimer,
    clearTimeout: clearTimer,
    sink: {
      setGains: (gains) => {
        pendingGains = { ...gains };
        applyVolumes();
      },
      fadeGains: options.fadeGains,
    },
  });

  function createAndStart(role: LayerRole, phaseOffsetSeconds: number): boolean {
    if (players.has(role)) return true;
    const moduleId = resolve(LAYER_ASSET_BY_ROLE[role]);
    if (moduleId == null) return false;
    let player: LayerAudioPlayer;
    try {
      player = options.createPlayer(moduleId);
    } catch (err) {
      soundWarn(`layer create ${role}`, err);
      return false;
    }
    try {
      if (player.loop != null) player.loop = true;
      player.volume = 0;
      const seek = player.seekTo(phaseOffsetSeconds);
      const playSafe = (): void => {
        try {
          player.play();
        } catch (err) {
          soundWarn(`layer play ${role}`, err);
        }
      };
      if (seek && typeof (seek as Promise<void>).then === 'function') {
        void (seek as Promise<void>).then(playSafe, playSafe);
      } else {
        playSafe();
      }
    } catch (err) {
      soundWarn(`layer start ${role}`, err);
      try {
        player.release();
      } catch (releaseErr) {
        soundWarn(`layer release ${role}`, releaseErr);
      }
      return false;
    }
    players.set(role, player);
    ready.add(role);
    return true;
  }

  function clearAlignTimer(): void {
    if (alignTimer == null) return;
    clearTimer(alignTimer);
    alignTimer = null;
  }

  function reAlignToMaster(): void {
    if (!started || wallT0Ms == null) return;
    const audioNow = now() / 1000;
    const t0 = scheduler.getT0();
    if (t0 == null) return;
    const phase = loopPhaseOffsetSeconds(t0, audioNow);
    for (const [role, player] of players) {
      try {
        const seek = player.seekTo(phase);
        if (seek && typeof (seek as Promise<void>).then === 'function') {
          void (seek as Promise<void>).catch((err: unknown) => {
            soundWarn(`layer realign ${role}`, err);
          });
        }
        if (!player.playing) player.play();
      } catch (err) {
        soundWarn(`layer realign ${role}`, err);
      }
    }
    const sample = sampleDrift();
    if (sample) driftLog.push(sample);
    scheduleNextAlign();
  }

  function scheduleNextAlign(): void {
    clearAlignTimer();
    if (!reAlignOnLoop || !started || wallT0Ms == null) return;
    const t0 = scheduler.getT0();
    if (t0 == null) return;
    const audioNow = now() / 1000;
    const elapsed = Math.max(0, audioNow - t0);
    const nextLoop = Math.floor(elapsed / LAYER_LOOP_SECONDS) + 1;
    const nextAt = t0 + nextLoop * LAYER_LOOP_SECONDS;
    const delayMs = Math.max(16, (nextAt - audioNow) * 1000);
    alignTimer = setTimer(() => {
      alignTimer = null;
      reAlignToMaster();
    }, delayMs);
  }

  function ensureStarted(): void {
    if (!enabled) return;
    if (started) return;
    wallT0Ms = now();
    const audioT0 = wallT0Ms / 1000;
    // Same JS tick: create every currently-ready role (pad at minimum).
    createAndStart('pad', 0);
    for (const role of LAZY_LAYER_ROLES) {
      if (ready.has(role) || scheduler.isLoaded(role)) {
        createAndStart(role, 0);
      }
    }
    scheduler.start(audioT0);
    started = true;
    scheduleNextAlign();
  }

  async function loadRole(role: LayerRole): Promise<void> {
    if (role === 'pad') {
      ensureStarted();
      scheduler.markLoaded('pad');
      return;
    }
    try {
      // Touch the module so Metro/web decode can warm.
      void resolve(LAYER_ASSET_BY_ROLE[role]);
      if (started) {
        const t0 = scheduler.getT0() ?? now() / 1000;
        const phase = loopPhaseOffsetSeconds(t0, now() / 1000);
        createAndStart(role, phase);
      } else {
        ready.add(role);
      }
      scheduler.markLoaded(role);
    } catch (err) {
      soundWarn(`layer load ${role}`, err);
    }
  }

  function startLazyLoads(): void {
    if (lazyStarted) return;
    lazyStarted = true;
    // Sequential background loads — off the interaction path.
    void (async () => {
      for (const role of LAZY_LAYER_ROLES) {
        await loadRole(role);
        // Yield between layers so card gestures stay smooth.
        await new Promise<void>((resolveYield) => {
          setTimer(() => resolveYield(), 0);
        });
      }
    })();
  }

  function sampleDrift(): DriftSample | null {
    if (!started || wallT0Ms == null) return null;
    const t0 = scheduler.getT0();
    if (t0 == null) return null;
    const audioNow = now() / 1000;
    const master = loopPhaseOffsetSeconds(t0, audioNow);
    let maxDrift = 0;
    if (options.getPositionSeconds) {
      for (const player of players.values()) {
        const pos = options.getPositionSeconds(player);
        if (pos == null || !Number.isFinite(pos)) continue;
        const phase = ((pos % LAYER_LOOP_SECONDS) + LAYER_LOOP_SECONDS) % LAYER_LOOP_SECONDS;
        maxDrift = Math.max(maxDrift, Math.abs(phase - master));
      }
    }
    return {
      elapsedMs: now() - wallT0Ms,
      maxDriftSeconds: maxDrift,
      masterPhaseSeconds: master,
    };
  }

  function stop(): void {
    clearAlignTimer();
    scheduler.stop();
    for (const [role, player] of players) {
      try {
        player.pause();
      } catch (err) {
        soundWarn(`layer pause ${role}`, err);
      }
      try {
        player.release();
      } catch (err) {
        soundWarn(`layer release ${role}`, err);
      }
    }
    players.clear();
    started = false;
    wallT0Ms = null;
  }

  return {
    scheduler,
    ensureStarted,
    loadRole,
    startLazyLoads,
    setEnabled: (next) => {
      enabled = next;
      scheduler.setEnabled(next);
      if (!next) stop();
    },
    setProgress: (c, l) => {
      scheduler.setProgress(c, l);
      if (enabled && !started) {
        // Defer audible start until ensureStarted (intro → bed / first card).
      }
    },
    setMasterGain: (gain) => {
      masterGain = Math.max(0, Math.min(1, gain));
      applyVolumes();
    },
    pause: () => {
      scheduler.pause();
      clearAlignTimer();
      for (const [role, player] of players) {
        try {
          player.pause();
        } catch (err) {
          soundWarn(`layer pause ${role}`, err);
        }
      }
    },
    resume: () => {
      if (!enabled) return;
      scheduler.resume();
      for (const [role, player] of players) {
        try {
          player.play();
        } catch (err) {
          soundWarn(`layer resume ${role}`, err);
        }
      }
      scheduleNextAlign();
    },
    stop,
    sampleDrift,
    getDriftLog: () => driftLog,
    getPlayerCount: () => players.size,
    isRoleReady: (role) => ready.has(role) || players.has(role),
  };
}
