/**
 * Adaptive layered background music — pure mapping + bar-quantized scheduler.
 *
 * Director ticket 1amjtrexgqf / Sound Design Master §13.
 * All six layers share one clock (sample 0); enter/leave by gain only.
 * Bar lines from durationSamples/44100/16 (never a rounded 3.333).
 */

import { gainFromDb } from '@/lib/soundMap';
import type { SoundAssetName } from '@/lib/soundAssets';

export const LAYER_SAMPLE_RATE = 44100;
export const LAYER_DURATION_SAMPLES = 2_352_000;
export const LAYER_BARS = 16;
export const LAYER_CROSSFADE_MS = 2000;

/** Exact loop length in seconds (AAC loopEnd on web). */
export const LAYER_LOOP_SECONDS = LAYER_DURATION_SAMPLES / LAYER_SAMPLE_RATE;

/** Exact bar length in seconds from samples — not 3.333. */
export const LAYER_BAR_SECONDS = LAYER_LOOP_SECONDS / LAYER_BARS;

export const LAYER_DURATION_MS = Math.round(LAYER_LOOP_SECONDS * 1000);

export type LayerRole =
  | 'pad'
  | 'pulse'
  | 'arp'
  | 'arp-bright'
  | 'rhythm'
  | 'extra';

export const LAYER_ROLES = [
  'pad',
  'pulse',
  'arp',
  'arp-bright',
  'rhythm',
  'extra',
] as const satisfies readonly LayerRole[];

export const LAYER_ASSET_BY_ROLE: Record<LayerRole, SoundAssetName> = {
  pad: 'music-layer-pad',
  pulse: 'music-layer-pulse',
  arp: 'music-layer-arp',
  'arp-bright': 'music-layer-arp-bright',
  rhythm: 'music-layer-rhythm',
  extra: 'music-layer-extra',
};

/** Pad loads with the base kit; these load lazily after first card. */
export const LAZY_LAYER_ROLES: readonly LayerRole[] = [
  'pulse',
  'arp',
  'arp-bright',
  'rhythm',
  'extra',
];

/** Manifest starting gainDb. */
export const LAYER_BASE_GAIN_DB: Record<LayerRole, number> = {
  pad: -2,
  pulse: -6,
  arp: -7,
  'arp-bright': -7,
  rhythm: -9,
  extra: -9,
};

export const LAYER_COMPLEXITY_MIN: Record<LayerRole, number> = {
  pad: 1,
  pulse: 2,
  arp: 3,
  'arp-bright': 3,
  rhythm: 4,
  extra: 5,
};

/** Laterality → colour / space (starting values; filter+width may be N/A on native). */
export const LATERALITY_MIX: Record<
  1 | 2 | 3 | 4 | 5,
  { lowpassHz: number; width: number; arp: 'arp' | 'arp-bright'; extraGainDb: number }
> = {
  1: { lowpassHz: 2500, width: 0.6, arp: 'arp', extraGainDb: -3 },
  2: { lowpassHz: 4000, width: 0.75, arp: 'arp', extraGainDb: -2 },
  3: { lowpassHz: 6500, width: 0.9, arp: 'arp', extraGainDb: -1 },
  4: { lowpassHz: 10000, width: 1.0, arp: 'arp-bright', extraGainDb: 0 },
  5: { lowpassHz: 16000, width: 1.15, arp: 'arp-bright', extraGainDb: 1 },
};

/** Bed attenuation at Complexity 4–5 (existing free-time beds). */
export const BED_HIGH_COMPLEXITY_GAIN_DB = -4;

/** Max existing textures at Complexity 4–5. */
export const HIGH_COMPLEXITY_TEXTURE_CAP = 1;

export type LayerTargets = {
  /** Linear gains (0 = silent). */
  gains: Record<LayerRole, number>;
  /** Authoring gains in dB (−Infinity when silent). */
  gainsDb: Record<LayerRole, number>;
  lowpassHz: number;
  width: number;
  arpRole: 'arp' | 'arp-bright';
};

function clampLevel(value: number): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(value);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as 2 | 3 | 4 | 5;
}

/**
 * Pure Complexity × Laterality → per-layer gains + colour.
 * Silent layers use gain 0 (−Infinity dB). Arp and arp-bright never both audible
 * except during an equal-power swap fade owned by the scheduler.
 */
export function layerTargets(complexity: number, laterality: number): LayerTargets {
  const c = clampLevel(complexity);
  const l = clampLevel(laterality);
  const mix = LATERALITY_MIX[l];
  const gainsDb = {} as Record<LayerRole, number>;
  const gains = {} as Record<LayerRole, number>;

  for (const role of LAYER_ROLES) {
    let db = Number.NEGATIVE_INFINITY;
    if (role === 'arp' || role === 'arp-bright') {
      if (c >= LAYER_COMPLEXITY_MIN.arp && role === mix.arp) {
        db = LAYER_BASE_GAIN_DB[role];
      }
    } else if (c >= LAYER_COMPLEXITY_MIN[role]) {
      db = LAYER_BASE_GAIN_DB[role];
      if (role === 'extra') db += mix.extraGainDb;
    }
    gainsDb[role] = db;
    gains[role] = Number.isFinite(db) ? gainFromDb(db) : 0;
  }

  return {
    gains,
    gainsDb,
    lowpassHz: mix.lowpassHz,
    width: mix.width,
    arpRole: mix.arp,
  };
}

/** Equal-power crossfade weights for t in [0, 1]. */
export function equalPowerWeights(t: number): { from: number; to: number } {
  const x = Math.max(0, Math.min(1, t));
  const angle = (x * Math.PI) / 2;
  return { from: Math.cos(angle), to: Math.sin(angle) };
}

/** Sample an equal-power gain curve from `from` → `to` (linear gain). */
export function equalPowerCurve(
  from: number,
  to: number,
  steps: number,
): Float32Array {
  const n = Math.max(2, steps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = equalPowerWeights(t);
    out[i] = from * w.from + to * w.to;
  }
  return out;
}

/**
 * Next bar-line time (seconds, same clock as `now`) after `now`, exclusive of
 * the current instant when already exactly on a bar (waits for the next one).
 */
export function nextBarTimeSeconds(t0Seconds: number, nowSeconds: number): number {
  const elapsed = Math.max(0, nowSeconds - t0Seconds);
  const bars = Math.floor(elapsed / LAYER_BAR_SECONDS) + 1;
  return t0Seconds + bars * LAYER_BAR_SECONDS;
}

/** Phase offset into the loop for a late-joining layer (shared clock). */
export function loopPhaseOffsetSeconds(t0Seconds: number, nowSeconds: number): number {
  const elapsed = Math.max(0, nowSeconds - t0Seconds);
  const phase = elapsed % LAYER_LOOP_SECONDS;
  return phase;
}

export type LayerGainSink = {
  /** Apply linear gains immediately (no fade). */
  setGains: (gains: Record<LayerRole, number>) => void;
  /** Apply colour (may no-op on native). */
  setColour?: (opts: { lowpassHz: number; width: number }) => void;
  /** Optional: schedule equal-power fade ending at `endTime` (web AudioContext). */
  fadeGains?: (
    from: Record<LayerRole, number>,
    to: Record<LayerRole, number>,
    startTimeSeconds: number,
    durationSeconds: number,
  ) => void;
};

export type LayerSchedulerOptions = {
  sink: LayerGainSink;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
  /** Wall-clock → audio-clock seconds. Defaults to now()/1000. */
  audioNow?: () => number;
  crossfadeMs?: number;
};

export type LayerScheduler = {
  /** Shared clock origin in audio seconds (null until start). */
  getT0: () => number | null;
  start: (audioT0?: number) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setEnabled: (enabled: boolean) => void;
  setProgress: (complexity: number, laterality: number) => void;
  /** Mark a lazy layer ready; may join on next bar if targeted. */
  markLoaded: (role: LayerRole) => void;
  isLoaded: (role: LayerRole) => boolean;
  getCurrentGains: () => Record<LayerRole, number>;
  getPendingTargets: () => LayerTargets | null;
  getAppliedTargets: () => LayerTargets | null;
  /** Test: force the pending bar tick now. */
  flushBarForTests: () => void;
};

/**
 * One pending target; latest wins before the bar. At the bar, 2 s equal-power
 * fade. Mid-fade changes wait for the next bar from current values.
 */
export function createLayerScheduler(options: LayerSchedulerOptions): LayerScheduler {
  const nowMs = options.now ?? (() => Date.now());
  const setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout ?? ((id) => clearTimeout(id));
  const audioNow =
    options.audioNow ?? (() => nowMs() / 1000);
  const crossfadeMs = options.crossfadeMs ?? LAYER_CROSSFADE_MS;
  const crossfadeSec = crossfadeMs / 1000;

  let enabled = true;
  let paused = false;
  let t0: number | null = null;
  let complexity = 3;
  let laterality = 3;
  let pending: LayerTargets | null = null;
  let applied: LayerTargets | null = null;
  let currentGains: Record<LayerRole, number> = Object.fromEntries(
    LAYER_ROLES.map((r) => [r, 0]),
  ) as Record<LayerRole, number>;
  let fading = false;
  let barTimer: ReturnType<typeof setTimeout> | null = null;
  const loaded = new Set<LayerRole>(['pad']);

  function clearBarTimer(): void {
    if (barTimer == null) return;
    clearTimer(barTimer);
    barTimer = null;
  }

  function audibleGains(targets: LayerTargets): Record<LayerRole, number> {
    const out = { ...targets.gains };
    for (const role of LAYER_ROLES) {
      if (!loaded.has(role)) out[role] = 0;
    }
    return out;
  }

  function applyColour(targets: LayerTargets): void {
    try {
      options.sink.setColour?.({
        lowpassHz: targets.lowpassHz,
        width: targets.width,
      });
    } catch (err) {
      console.warn('[sound] layer colour', err);
    }
  }

  function commitFade(targets: LayerTargets): void {
    const to = audibleGains(targets);
    const from = { ...currentGains };
    fading = true;
    applyColour(targets);

    const startAudio = audioNow();
    try {
      if (options.sink.fadeGains) {
        options.sink.fadeGains(from, to, startAudio, crossfadeSec);
      } else {
        // Timer-step equal-power fallback (native / tests).
        const steps = Math.max(8, Math.round(crossfadeMs / 50));
        const curves = {} as Record<LayerRole, Float32Array>;
        for (const role of LAYER_ROLES) {
          curves[role] = equalPowerCurve(from[role], to[role], steps);
        }
        let i = 0;
        const stepMs = crossfadeMs / (steps - 1);
        const tick = (): void => {
          if (!enabled || paused) return;
          for (const role of LAYER_ROLES) {
            currentGains[role] = curves[role]![i]!;
          }
          try {
            options.sink.setGains({ ...currentGains });
          } catch (err) {
            console.warn('[sound] layer fade step', err);
          }
          i += 1;
          if (i < steps) {
            setTimer(tick, stepMs);
            return;
          }
          currentGains = { ...to };
          fading = false;
          applied = targets;
        };
        tick();
        return;
      }
    } catch (err) {
      console.warn('[sound] layer fade', err);
    }

    // Web path: assume AudioParam curve runs; snap bookkeeping after duration.
    setTimer(() => {
      currentGains = { ...to };
      fading = false;
      applied = targets;
    }, crossfadeMs);
  }

  function fireBar(): void {
    barTimer = null;
    if (!enabled || paused || t0 == null || pending == null) return;
    if (fading) {
      // Wait for next bar after current fade settles.
      scheduleBar();
      return;
    }
    const targets = pending;
    pending = null;
    commitFade(targets);
  }

  function scheduleBar(): void {
    clearBarTimer();
    if (!enabled || paused || t0 == null || pending == null) return;
    const nowA = audioNow();
    const barAt = nextBarTimeSeconds(t0, nowA);
    const delayMs = Math.max(0, (barAt - nowA) * 1000);
    barTimer = setTimer(fireBar, delayMs);
  }

  function queueFromProgress(): void {
    if (!enabled || t0 == null) return;
    pending = layerTargets(complexity, laterality);
    scheduleBar();
  }

  function start(audioT0?: number): void {
    if (t0 != null) return;
    t0 = audioT0 ?? audioNow();
    paused = false;
    const initial = layerTargets(complexity, laterality);
    applied = initial;
    currentGains = audibleGains(initial);
    try {
      options.sink.setGains({ ...currentGains });
      applyColour(initial);
    } catch (err) {
      console.warn('[sound] layer start gains', err);
    }
    pending = null;
  }

  function stop(): void {
    clearBarTimer();
    pending = null;
    fading = false;
    t0 = null;
    currentGains = Object.fromEntries(LAYER_ROLES.map((r) => [r, 0])) as Record<
      LayerRole,
      number
    >;
    try {
      options.sink.setGains({ ...currentGains });
    } catch (err) {
      console.warn('[sound] layer stop', err);
    }
  }

  function pause(): void {
    paused = true;
    clearBarTimer();
  }

  function resume(): void {
    if (!paused) return;
    paused = false;
    if (pending) scheduleBar();
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    if (!next) {
      stop();
    }
  }

  function setProgress(c: number, l: number): void {
    complexity = c;
    laterality = l;
    if (t0 == null || !enabled) return;
    queueFromProgress();
  }

  function markLoaded(role: LayerRole): void {
    if (loaded.has(role)) return;
    loaded.add(role);
    if (t0 == null || !enabled) return;
    // Re-queue so a newly loaded layer can join on the next bar.
    queueFromProgress();
  }

  return {
    getT0: () => t0,
    start,
    stop,
    pause,
    resume,
    setEnabled,
    setProgress,
    markLoaded,
    isLoaded: (role) => loaded.has(role),
    getCurrentGains: () => ({ ...currentGains }),
    getPendingTargets: () => pending,
    getAppliedTargets: () => applied,
    flushBarForTests: () => {
      clearBarTimer();
      fireBar();
    },
  };
}
