/**
 * Web Adaptive layer graph (Sound 8 preview).
 *
 * One AudioBufferSourceNode per layer, shared AudioContext start time,
 * loopEnd = durationSamples/44100. Chain: layer Gain → group BiquadFilter
 * (lowpass) → M/S width → group gain → destination.
 */

import { getSoundAsset } from '@/lib/soundAssets';
import {
  createLayerScheduler,
  equalPowerCurve,
  LAZY_LAYER_ROLES,
  LAYER_ASSET_BY_ROLE,
  LAYER_DURATION_SAMPLES,
  LAYER_LOOP_SECONDS,
  LAYER_ROLES,
  LAYER_SAMPLE_RATE,
  loopPhaseOffsetSeconds,
  type LayerRole,
  type LayerScheduler,
} from '@/lib/soundLayers';
import { soundWarn } from '@/lib/soundWarn';

export const WEB_LAYER_LOOP_END = LAYER_DURATION_SAMPLES / LAYER_SAMPLE_RATE;

type DecodeFn = (uri: string) => Promise<AudioBuffer>;
type ResolveUriFn = (moduleId: number | string) => string | null;

export type WebLayerGraph = {
  scheduler: LayerScheduler;
  ensureStarted: () => void;
  startLazyLoads: () => void;
  setEnabled: (enabled: boolean) => void;
  setProgress: (complexity: number, laterality: number) => void;
  setMasterGain: (gain: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getSharedStartTime: () => number | null;
  getLoopEnd: () => number;
};

export type WebLayerGraphOptions = {
  getContext: () => AudioContext | null;
  resolveUri: ResolveUriFn;
  decode: DecodeFn;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
};

type LayerNodes = {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  buffer: AudioBuffer | null;
  started: boolean;
};

export function createWebLayerGraph(options: WebLayerGraphOptions): WebLayerGraph {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout ?? ((id) => clearTimeout(id));

  let ctx: AudioContext | null = null;
  let filter: BiquadFilterNode | null = null;
  let midGain: GainNode | null = null;
  let sideGain: GainNode | null = null;
  let groupGain: GainNode | null = null;
  let splitter: ChannelSplitterNode | null = null;
  let merger: ChannelMergerNode | null = null;
  let sharedStart: number | null = null;
  let enabled = true;
  let lazyStarted = false;
  const layers = new Map<LayerRole, LayerNodes>();
  const loaded = new Set<LayerRole>(['pad']);

  function ensureGraph(): boolean {
    if (groupGain && filter) return true;
    ctx = options.getContext();
    if (!ctx) return false;
    try {
      groupGain = ctx.createGain();
      groupGain.gain.value = 1;
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 6500;
      // Mid/side width: split → mid (L+R)/approx + side*(width) → merge.
      splitter = ctx.createChannelSplitter(2);
      merger = ctx.createChannelMerger(2);
      midGain = ctx.createGain();
      sideGain = ctx.createGain();
      midGain.gain.value = 1;
      sideGain.gain.value = 0.9;

      filter.connect(splitter);
      // L and R both into mid and side paths (simple M/S approx).
      splitter.connect(midGain, 0);
      splitter.connect(midGain, 1);
      splitter.connect(sideGain, 0);
      splitter.connect(sideGain, 1);
      midGain.connect(merger, 0, 0);
      midGain.connect(merger, 0, 1);
      sideGain.connect(merger, 0, 0);
      // Invert-ish side into R by connecting same; width scales sideGain.
      sideGain.connect(merger, 0, 1);
      merger.connect(groupGain);
      groupGain.connect(ctx.destination);
      return true;
    } catch (err) {
      soundWarn('web layer graph', err);
      return false;
    }
  }

  function layerOrCreate(role: LayerRole): LayerNodes | null {
    const existing = layers.get(role);
    if (existing) return existing;
    if (!ensureGraph() || !ctx || !filter) return null;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(filter);
      const nodes: LayerNodes = {
        source: null,
        gain,
        buffer: null,
        started: false,
      };
      layers.set(role, nodes);
      return nodes;
    } catch (err) {
      soundWarn(`web layer node ${role}`, err);
      return null;
    }
  }

  function startSource(role: LayerRole, buffer: AudioBuffer, when: number, offset: number): void {
    const nodes = layers.get(role);
    if (!nodes || !ctx) return;
    try {
      if (nodes.source) {
        try {
          nodes.source.stop();
        } catch {
          // already stopped
        }
        try {
          nodes.source.disconnect();
        } catch {
          // ignore
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = WEB_LAYER_LOOP_END;
      src.connect(nodes.gain);
      const startOffset = ((offset % LAYER_LOOP_SECONDS) + LAYER_LOOP_SECONDS) % LAYER_LOOP_SECONDS;
      src.start(when, startOffset);
      nodes.source = src;
      nodes.started = true;
      nodes.buffer = buffer;
    } catch (err) {
      soundWarn(`web layer start ${role}`, err);
    }
  }

  async function decodeRole(role: LayerRole): Promise<AudioBuffer | null> {
    const asset = getSoundAsset(LAYER_ASSET_BY_ROLE[role]);
    const uri = options.resolveUri(asset.module);
    if (!uri) return null;
    try {
      return await options.decode(uri);
    } catch (err) {
      soundWarn(`web layer decode ${role}`, err);
      return null;
    }
  }

  const scheduler = createLayerScheduler({
    now,
    setTimeout: setTimer,
    clearTimeout: clearTimer,
    audioNow: () => {
      const c = options.getContext();
      return c ? c.currentTime : now() / 1000;
    },
    sink: {
      setGains: (gains) => {
        for (const role of LAYER_ROLES) {
          const nodes = layers.get(role);
          if (!nodes) continue;
          try {
            nodes.gain.gain.value = gains[role]!;
          } catch (err) {
            soundWarn('web layer gain', err);
          }
        }
      },
      setColour: ({ lowpassHz, width }) => {
        if (!filter || !sideGain) return;
        try {
          filter.frequency.value = lowpassHz;
          // width 1.0 ≈ unity side; scale around 1.
          sideGain.gain.value = Math.max(0, width);
        } catch (err) {
          soundWarn('web layer colour', err);
        }
      },
      fadeGains: (from, to, startTime, duration) => {
        if (!ctx) return;
        const steps = Math.max(8, Math.round(duration * 50));
        for (const role of LAYER_ROLES) {
          const nodes = layers.get(role);
          if (!nodes) continue;
          try {
            const curve = equalPowerCurve(from[role]!, to[role]!, steps);
            nodes.gain.gain.cancelScheduledValues(startTime);
            nodes.gain.gain.setValueCurveAtTime(curve, startTime, duration);
          } catch (err) {
            soundWarn('web layer fade', err);
            try {
              nodes.gain.gain.setValueAtTime(to[role]!, startTime + duration);
            } catch (err2) {
              soundWarn('web layer fade snap', err2);
            }
          }
        }
      },
    },
  });

  function ensureStarted(): void {
    if (!enabled) return;
    if (!ensureGraph() || !ctx) return;
    if (sharedStart != null) return;

    const when = ctx.currentTime + 0.05;
    sharedStart = when;

    // Start every already-decoded layer at the same when (sample 0).
    for (const role of LAYER_ROLES) {
      if (!loaded.has(role)) continue;
      const nodes = layerOrCreate(role);
      if (!nodes?.buffer) continue;
      startSource(role, nodes.buffer, when, 0);
    }

    scheduler.start(when);

    // Pad must be present — kick decode if missing.
    void (async () => {
      const buf = await decodeRole('pad');
      if (!buf || !ctx) return;
      const nodes = layerOrCreate('pad');
      if (!nodes) return;
      nodes.buffer = buf;
      loaded.add('pad');
      scheduler.markLoaded('pad');
      if (!nodes.started && sharedStart != null) {
        const nowA = ctx.currentTime;
        const offset = loopPhaseOffsetSeconds(sharedStart, nowA);
        startSource('pad', buf, nowA, offset);
      }
    })();
  }

  function startLazyLoads(): void {
    if (lazyStarted) return;
    lazyStarted = true;
    void (async () => {
      for (const role of LAZY_LAYER_ROLES) {
        const buf = await decodeRole(role);
        if (!buf) continue;
        loaded.add(role);
        const nodes = layerOrCreate(role);
        if (nodes) nodes.buffer = buf;
        if (sharedStart != null && ctx && nodes && !nodes.started) {
          const nowA = ctx.currentTime;
          const offset = loopPhaseOffsetSeconds(sharedStart, nowA);
          startSource(role, buf, nowA, offset);
        }
        scheduler.markLoaded(role);
        await new Promise<void>((r) => setTimer(() => r(), 0));
      }
    })();
  }

  function stop(): void {
    scheduler.stop();
    for (const [role, nodes] of layers) {
      try {
        nodes.source?.stop();
      } catch (err) {
        soundWarn(`web layer stop ${role}`, err);
      }
      try {
        nodes.source?.disconnect();
      } catch {
        // ignore
      }
      nodes.source = null;
      nodes.started = false;
    }
    sharedStart = null;
  }

  return {
    scheduler,
    ensureStarted,
    startLazyLoads,
    setEnabled: (next) => {
      enabled = next;
      scheduler.setEnabled(next);
      if (!next) stop();
    },
    setProgress: (c, l) => scheduler.setProgress(c, l),
    setMasterGain: (gain) => {
      if (!groupGain) return;
      try {
        groupGain.gain.value = Math.max(0, Math.min(1, gain));
      } catch (err) {
        soundWarn('web layer master', err);
      }
    },
    pause: () => {
      scheduler.pause();
      // Keep sources running silently via gain 0 would drift; stop group gain.
      if (groupGain) {
        try {
          groupGain.gain.value = 0;
        } catch (err) {
          soundWarn('web layer pause', err);
        }
      }
    },
    resume: () => {
      scheduler.resume();
      if (groupGain) {
        try {
          groupGain.gain.value = 1;
        } catch (err) {
          soundWarn('web layer resume', err);
        }
      }
    },
    stop,
    getSharedStartTime: () => sharedStart,
    getLoopEnd: () => WEB_LAYER_LOOP_END,
  };
}
