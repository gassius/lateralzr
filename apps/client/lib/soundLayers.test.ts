import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAdaptiveLayerGroup } from '@/lib/soundLayerPlayers';
import { createWebLayerGraph } from '@/lib/soundLayerWebGraph';
import { gainFromDb } from '@/lib/soundMap';
import {
  BED_HIGH_COMPLEXITY_GAIN_DB,
  createLayerScheduler,
  equalPowerCurve,
  equalPowerWeights,
  HIGH_COMPLEXITY_TEXTURE_CAP,
  LAZY_LAYER_ROLES,
  LAYER_ASSET_BY_ROLE,
  LAYER_BAR_SECONDS,
  LAYER_BASE_GAIN_DB,
  LAYER_CROSSFADE_MS,
  LAYER_DURATION_SAMPLES,
  LAYER_LOOP_SECONDS,
  LAYER_ROLES,
  LAYER_SAMPLE_RATE,
  layerTargets,
  nextBarTimeSeconds,
  type LayerRole,
} from '@/lib/soundLayers';
import {
  bedLayerGainForComplexity,
  textureCountForProgress,
  texturesForProgress,
} from '@/lib/soundMusic';

type TimerHandle = ReturnType<typeof setTimeout>;

function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers = {
    setTimeout(fn: () => void, delay?: number) {
      const id = nextId++;
      pending.set(id, { at: now + (delay ?? 0), fn });
      return id as unknown as TimerHandle;
    },
    clearTimeout(id: TimerHandle) {
      pending.delete(id as unknown as number);
    },
  };
  function advance(ms: number) {
    const target = now + ms;
    while (true) {
      const due = [...pending.entries()]
        .filter(([, item]) => item.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) {
        now = target;
        break;
      }
      const [id, item] = due[0]!;
      now = item.at;
      pending.delete(id);
      item.fn();
    }
  }
  return { now: () => now, timers, advance };
}

function mockLayerPlayer() {
  const player = {
    volume: 0,
    playing: false,
    loop: true,
    play() {
      player.playing = true;
    },
    pause() {
      player.playing = false;
    },
    seekTo() {},
    release() {},
  };
  return player;
}

function fakeAudioContext() {
  const calls = {
    biquad: 0,
    splitter: 0,
    merger: 0,
    gain: 0,
    bufferSource: 0,
  };
  const makeGain = () => ({
    gain: {
      value: 1,
      cancelScheduledValues() {},
      setValueCurveAtTime() {},
      setValueAtTime() {},
    },
    connect() {},
    disconnect() {},
  });
  const ctx = {
    currentTime: 0,
    destination: {},
    createGain() {
      calls.gain += 1;
      return makeGain();
    },
    createBiquadFilter() {
      calls.biquad += 1;
      return {
        type: 'lowpass',
        frequency: { value: 0 },
        connect() {},
      };
    },
    createChannelSplitter() {
      calls.splitter += 1;
      return { connect() {} };
    },
    createChannelMerger() {
      calls.merger += 1;
      return { connect() {} };
    },
    createBufferSource() {
      calls.bufferSource += 1;
      return {
        buffer: null as AudioBuffer | null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        connect() {},
        start() {},
        stop() {},
        disconnect() {},
      };
    },
  };
  return { ctx: ctx as unknown as AudioContext, calls };
}

test('bar length comes from durationSamples/44100/16 (not 3.333)', () => {
  assert.equal(LAYER_DURATION_SAMPLES, 2_352_000);
  assert.equal(LAYER_LOOP_SECONDS, LAYER_DURATION_SAMPLES / LAYER_SAMPLE_RATE);
  assert.equal(LAYER_BAR_SECONDS, LAYER_LOOP_SECONDS / 16);
  assert.notEqual(LAYER_BAR_SECONDS, 3.333);
  assert.ok(Math.abs(LAYER_BAR_SECONDS - 3.3333333333333335) < 1e-12);
});

test('layerTargets: Complexity 1–5 adds pad→pulse→arp→rhythm→extra', () => {
  const order: LayerRole[] = ['pad', 'pulse', 'arp', 'rhythm', 'extra'];
  for (let c = 1; c <= 5; c++) {
    const t = layerTargets(c, 3);
    for (let i = 0; i < order.length; i++) {
      const role = order[i]!;
      if (i < c) {
        assert.ok(t.gains[role] > 0, `C${c} ${role} should be audible`);
      } else {
        assert.equal(t.gains[role], 0, `C${c} ${role} should be silent`);
      }
    }
    // arp-bright silent at L3
    assert.equal(t.gains['arp-bright'], 0);
    assert.equal(t.arpRole, 'arp');
  }
});

test('layerTargets: Laterality swaps arp→arp-bright at 4–5 and offsets extra', () => {
  for (let l = 1; l <= 3; l++) {
    const t = layerTargets(5, l);
    assert.equal(t.arpRole, 'arp');
    assert.ok(t.gains.arp > 0);
    assert.equal(t.gains['arp-bright'], 0);
  }
  for (let l = 4; l <= 5; l++) {
    const t = layerTargets(5, l);
    assert.equal(t.arpRole, 'arp-bright');
    assert.equal(t.gains.arp, 0);
    assert.ok(t.gains['arp-bright'] > 0);
  }
  assert.ok(
    Math.abs(layerTargets(5, 1).gains.extra - gainFromDb(LAYER_BASE_GAIN_DB.extra - 3)) < 1e-9,
  );
  assert.ok(
    Math.abs(layerTargets(5, 5).gains.extra - gainFromDb(LAYER_BASE_GAIN_DB.extra + 1)) < 1e-9,
  );
});

test('equal-power curve endpoints and mid blend', () => {
  const w0 = equalPowerWeights(0);
  const w1 = equalPowerWeights(1);
  const wMid = equalPowerWeights(0.5);
  assert.ok(Math.abs(w0.from - 1) < 1e-9);
  assert.ok(Math.abs(w0.to - 0) < 1e-9);
  assert.ok(Math.abs(w1.from - 0) < 1e-9);
  assert.ok(Math.abs(w1.to - 1) < 1e-9);
  assert.ok(Math.abs(wMid.from - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(wMid.to - Math.SQRT1_2) < 1e-9);

  const curve = equalPowerCurve(0, 1, 5);
  assert.equal(curve.length, 5);
  assert.equal(curve[0], 0);
  assert.ok(Math.abs(curve[4]! - 1) < 1e-9);
  assert.ok(curve[2]! > 0.5); // equal-power mid > linear mid
});

test('scheduler: latest-wins before bar; 2s fade; no stack', () => {
  let now = 0;
  let audioNow = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;
  const gainsLog: Array<Record<LayerRole, number>> = [];

  const scheduler = createLayerScheduler({
    now: () => now,
    audioNow: () => audioNow,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + (ms ?? 0), fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (id) => {
      timers.delete(id as unknown as number);
    },
    sink: {
      setGains: (gains) => {
        gainsLog.push({ ...gains });
      },
    },
    crossfadeMs: LAYER_CROSSFADE_MS,
  });

  function advance(ms: number): void {
    const target = now + ms;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) {
        now = target;
        audioNow = target / 1000;
        break;
      }
      const [id, item] = due[0]!;
      now = item.at;
      audioNow = now / 1000;
      timers.delete(id);
      item.fn();
    }
  }

  scheduler.start(0);
  // C1 pad only at start
  assert.ok((scheduler.getCurrentGains().pad ?? 0) > 0);
  assert.equal(scheduler.getCurrentGains().pulse, 0);

  // Mark pulse loaded so it can join
  scheduler.markLoaded('pulse');
  scheduler.setProgress(2, 3);
  assert.ok(scheduler.getPendingTargets());
  // Another change before bar — latest wins (C3)
  scheduler.markLoaded('arp');
  scheduler.setProgress(3, 3);
  const pending = scheduler.getPendingTargets();
  assert.ok(pending);
  assert.ok(pending!.gains.arp > 0);
  assert.ok(pending!.gains.pulse > 0);

  // Advance just under one bar — still pending
  advance(LAYER_BAR_SECONDS * 1000 - 10);
  assert.ok(scheduler.getPendingTargets());

  // Cross the bar — fade begins; pending cleared
  advance(20);
  assert.equal(scheduler.getPendingTargets(), null);

  // Complete 2 s fade
  advance(LAYER_CROSSFADE_MS + 50);
  assert.ok(scheduler.getCurrentGains().arp > 0);
  assert.ok(scheduler.getCurrentGains().pulse > 0);
});

test('scheduler: unloaded layer stays at 0 until markLoaded then next bar', () => {
  let now = 0;
  let audioNow = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;
  const scheduler = createLayerScheduler({
    now: () => now,
    audioNow: () => audioNow,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + (ms ?? 0), fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (id) => {
      timers.delete(id as unknown as number);
    },
    sink: { setGains: () => {} },
  });
  function advance(ms: number): void {
    const target = now + ms;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) {
        now = target;
        audioNow = target / 1000;
        break;
      }
      const [id, item] = due[0]!;
      now = item.at;
      audioNow = now / 1000;
      timers.delete(id);
      item.fn();
    }
  }

  scheduler.start(0);
  scheduler.setProgress(5, 5);
  advance(LAYER_BAR_SECONDS * 1000 + LAYER_CROSSFADE_MS + 10);
  // Only pad loaded — higher layers silent
  assert.equal(scheduler.getCurrentGains().pulse, 0);
  assert.equal(scheduler.getCurrentGains().extra, 0);

  scheduler.markLoaded('pulse');
  advance(LAYER_BAR_SECONDS * 1000 + LAYER_CROSSFADE_MS + 10);
  assert.ok(scheduler.getCurrentGains().pulse > 0);
});

test('nextBarTimeSeconds waits for the next bar when exactly on a line', () => {
  const t0 = 10;
  assert.equal(nextBarTimeSeconds(t0, t0), t0 + LAYER_BAR_SECONDS);
  assert.equal(nextBarTimeSeconds(t0, t0 + LAYER_BAR_SECONDS), t0 + 2 * LAYER_BAR_SECONDS);
});

test('C4–5: texture cap 1 and bed −4 dB', () => {
  assert.equal(HIGH_COMPLEXITY_TEXTURE_CAP, 1);
  assert.equal(BED_HIGH_COMPLEXITY_GAIN_DB, -4);
  assert.equal(textureCountForProgress(0.95, false, 5), 1);
  assert.equal(textureCountForProgress(0.95, false, 4), 1);
  assert.ok(textureCountForProgress(0.95, false, 3) >= 2);
  assert.equal(texturesForProgress(0.95, false, 5).length, 1);
  assert.equal(bedLayerGainForComplexity(3), 1);
  assert.ok(Math.abs(bedLayerGainForComplexity(4) - gainFromDb(-4)) < 1e-9);
  assert.ok(Math.abs(bedLayerGainForComplexity(5) - gainFromDb(-4)) < 1e-9);
});

test('every layer role is covered by LAYER_ROLES', () => {
  assert.deepEqual([...LAYER_ROLES], [
    'pad',
    'pulse',
    'arp',
    'arp-bright',
    'rhythm',
    'extra',
  ]);
});

test('web graph applies same per-layer gains as native and creates no filter nodes (B1)', async () => {
  const clock = createFakeClock();
  const nativeByRole = new Map<LayerRole, ReturnType<typeof mockLayerPlayer>>();
  const assetToRole = new Map(
    (Object.entries(LAYER_ASSET_BY_ROLE) as Array<[LayerRole, string]>).map(
      ([role, asset]) => [asset, role] as const,
    ),
  );

  const native = createAdaptiveLayerGroup({
    createPlayer: (moduleId) => {
      const p = mockLayerPlayer();
      // resolveModule returns the asset name string in this test.
      const role = assetToRole.get(String(moduleId));
      assert.ok(role, `unexpected module ${String(moduleId)}`);
      nativeByRole.set(role, p);
      return p;
    },
    resolveModule: (name) => name as unknown as number,
    now: clock.now,
    setTimeout: clock.timers.setTimeout,
    clearTimeout: clock.timers.clearTimeout,
    reAlignOnLoop: false,
  });

  const { ctx, calls } = fakeAudioContext();
  // Track every GainNode so we can read gains the web graph actually applies.
  const gainNodes: Array<{ gain: { value: number } }> = [];
  const origCreateGain = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const g = origCreateGain();
    gainNodes.push(g);
    return g;
  };

  const silentBuf = {
    duration: LAYER_LOOP_SECONDS,
    length: 1,
    numberOfChannels: 2,
    sampleRate: LAYER_SAMPLE_RATE,
  } as unknown as AudioBuffer;

  const web = createWebLayerGraph({
    getContext: () => ctx,
    resolveUri: () => 'asset://layer',
    decode: async () => silentBuf,
    now: clock.now,
    setTimeout: clock.timers.setTimeout,
    clearTimeout: clock.timers.clearTimeout,
  });

  native.ensureStarted();
  for (const role of LAZY_LAYER_ROLES) {
    await native.loadRole(role);
  }

  web.ensureStarted();
  web.startLazyLoads();
  // Drain pad + lazy decode microtasks and inter-role setTimeout(0) yields
  // until group + every layer GainNode exists (creation order = LAYER_ROLES).
  const expectedGainNodes = 1 + LAYER_ROLES.length;
  for (let i = 0; i < 40 && gainNodes.length < expectedGainNodes; i++) {
    clock.advance(0);
    await Promise.resolve();
    await Promise.resolve();
  }

  assert.equal(calls.biquad, 0, 'web must not create BiquadFilter');
  assert.equal(calls.splitter, 0, 'web must not create ChannelSplitter');
  assert.equal(calls.merger, 0, 'web must not create ChannelMerger');

  assert.equal(
    gainNodes.length,
    expectedGainNodes,
    `expected group + ${LAYER_ROLES.length} layer gains, got ${gainNodes.length}`,
  );
  const webGainByRole = new Map<LayerRole, { gain: { value: number } }>();
  LAYER_ROLES.forEach((role, i) => {
    webGainByRole.set(role, gainNodes[1 + i]!);
  });

  function nativeApplied(): Record<LayerRole, number> {
    const out = {} as Record<LayerRole, number>;
    for (const role of LAYER_ROLES) {
      out[role] = nativeByRole.get(role)?.volume ?? 0;
    }
    return out;
  }
  function webApplied(): Record<LayerRole, number> {
    const out = {} as Record<LayerRole, number>;
    for (const role of LAYER_ROLES) {
      out[role] = webGainByRole.get(role)!.gain.value;
    }
    return out;
  }

  for (let c = 1; c <= 5; c++) {
    for (let l = 1; l <= 5; l++) {
      native.setProgress(c, l);
      web.setProgress(c, l);
      native.scheduler.flushBarForTests();
      web.scheduler.flushBarForTests();
      // Complete the 2 s equal-power fade on both (finishFade → setGains).
      clock.advance(LAYER_CROSSFADE_MS + 20);
      const expected = layerTargets(c, l).gains;
      assert.deepEqual(nativeApplied(), expected, `native player volumes at C${c} L${l}`);
      assert.deepEqual(webApplied(), expected, `web GainNode values at C${c} L${l}`);
      assert.deepEqual(webApplied(), nativeApplied(), `web vs native applied gains at C${c} L${l}`);
    }
  }
  assert.equal(calls.biquad, 0);
  assert.equal(calls.splitter, 0);
  assert.equal(calls.merger, 0);
});

test('pause mid-fade then resume continues; next bar still applies (B3)', () => {
  const clock = createFakeClock();
  const scheduler = createLayerScheduler({
    now: clock.now,
    audioNow: () => clock.now() / 1000,
    setTimeout: clock.timers.setTimeout,
    clearTimeout: clock.timers.clearTimeout,
    sink: { setGains: () => {} },
    crossfadeMs: LAYER_CROSSFADE_MS,
  });

  scheduler.start(0);
  for (const role of LAZY_LAYER_ROLES) scheduler.markLoaded(role);

  scheduler.setProgress(5, 3);
  // Cross the bar to start the fade.
  clock.advance(LAYER_BAR_SECONDS * 1000 + 5);
  const midGains = scheduler.getCurrentGains();
  assert.ok(midGains.pad > 0);

  // Background mid-fade (AppState) — pause before the 2 s fade finishes.
  clock.advance(400);
  const pausedAt = { ...scheduler.getCurrentGains() };
  scheduler.pause();
  clock.advance(5000); // time passes while backgrounded — mix must not stuck-fade
  assert.deepEqual(scheduler.getCurrentGains(), pausedAt);

  scheduler.resume();
  clock.advance(LAYER_CROSSFADE_MS + 50);
  assert.deepEqual(scheduler.getCurrentGains(), layerTargets(5, 3).gains);
  assert.ok(scheduler.getAppliedTargets());

  // Next Complexity change after resume still applies (not frozen).
  scheduler.setProgress(1, 3);
  clock.advance(LAYER_BAR_SECONDS * 1000 + LAYER_CROSSFADE_MS + 50);
  assert.deepEqual(scheduler.getCurrentGains(), layerTargets(1, 3).gains);
  assert.equal(scheduler.getCurrentGains().pulse, 0);
  assert.equal(scheduler.getCurrentGains().extra, 0);
});

test('pause mid-fade on snap path resumes remaining fade (B3 backgrounding)', () => {
  const clock = createFakeClock();
  const scheduler = createLayerScheduler({
    now: clock.now,
    audioNow: () => clock.now() / 1000,
    setTimeout: clock.timers.setTimeout,
    clearTimeout: clock.timers.clearTimeout,
    sink: {
      setGains: () => {},
      fadeGains: () => {},
    },
    crossfadeMs: LAYER_CROSSFADE_MS,
  });

  scheduler.start(0);
  for (const role of LAZY_LAYER_ROLES) scheduler.markLoaded(role);
  scheduler.setProgress(5, 3);
  clock.advance(LAYER_BAR_SECONDS * 1000 + 5);
  // Mid snap-fade (web path): background, wait past the original deadline, resume.
  clock.advance(400);
  scheduler.pause();
  clock.advance(LAYER_CROSSFADE_MS + 500);
  assert.notDeepEqual(scheduler.getCurrentGains(), layerTargets(5, 3).gains);
  scheduler.resume();
  // Remaining snap was already overdue → finish immediately on resume.
  assert.deepEqual(scheduler.getCurrentGains(), layerTargets(5, 3).gains);

  scheduler.setProgress(1, 3);
  clock.advance(LAYER_BAR_SECONDS * 1000 + LAYER_CROSSFADE_MS + 20);
  assert.deepEqual(scheduler.getCurrentGains(), layerTargets(1, 3).gains);
});

test('stop() clears in-flight snap/fade timers so fading cannot stick (B3)', () => {
  const clock = createFakeClock();
  let setGainsCalls = 0;
  const scheduler = createLayerScheduler({
    now: clock.now,
    audioNow: () => clock.now() / 1000,
    setTimeout: clock.timers.setTimeout,
    clearTimeout: clock.timers.clearTimeout,
    sink: {
      setGains: () => {
        setGainsCalls += 1;
      },
      // Force the web snap-timer path.
      fadeGains: () => {},
    },
    crossfadeMs: LAYER_CROSSFADE_MS,
  });

  scheduler.start(0);
  scheduler.markLoaded('pulse');
  scheduler.setProgress(2, 3);
  clock.advance(LAYER_BAR_SECONDS * 1000 + 5);
  const callsBeforeStop = setGainsCalls;
  scheduler.stop();
  // Advancing past the old snap deadline must not resurrect gains / fading.
  clock.advance(LAYER_CROSSFADE_MS + 100);
  assert.equal(setGainsCalls, callsBeforeStop + 1); // stop() zeros once
  assert.deepEqual(
    scheduler.getCurrentGains(),
    Object.fromEntries(LAYER_ROLES.map((r) => [r, 0])),
  );

  // A fresh start after stop must accept new progress (not stuck fading).
  scheduler.start(clock.now() / 1000);
  scheduler.markLoaded('pulse');
  scheduler.setProgress(2, 3);
  clock.advance(LAYER_BAR_SECONDS * 1000 + LAYER_CROSSFADE_MS + 20);
  assert.ok(scheduler.getCurrentGains().pulse > 0);
});

test('web resume restores master/duck gain (not forced to 1)', () => {
  const clock = createFakeClock();
  const { ctx } = fakeAudioContext();
  const gainNodes: Array<{ gain: { value: number } }> = [];
  const origCreateGain = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const g = origCreateGain();
    gainNodes.push(g);
    return g;
  };

  const web = createWebLayerGraph({
    getContext: () => ctx,
    resolveUri: () => null,
    decode: async () => {
      throw new Error('unused');
    },
    now: clock.now,
    setTimeout: clock.timers.setTimeout,
    clearTimeout: clock.timers.clearTimeout,
  });

  web.ensureStarted();
  assert.ok(gainNodes.length >= 1);
  const group = gainNodes[0]!;
  web.setMasterGain(0.35);
  assert.equal(group.gain.value, 0.35);
  web.pause();
  assert.equal(group.gain.value, 0);
  web.resume();
  assert.equal(group.gain.value, 0.35);
});

test('web layer graph module is not a Metro platform override of soundLayers', async () => {
  // Guard against reintroducing soundLayers.web.ts, which Metro would resolve
  // instead of the shared soundLayers.ts and break createLayerScheduler on web.
  const { readFileSync, existsSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  assert.equal(existsSync(join(here, 'soundLayers.web.ts')), false);
  assert.equal(existsSync(join(here, 'soundLayerWebGraph.ts')), true);
  const webImport = readFileSync(join(here, 'sound.web.ts'), 'utf8');
  assert.match(webImport, /from '@\/lib\/soundLayerWebGraph'/);
  assert.doesNotMatch(webImport, /from '@\/lib\/soundLayers\.web'/);
  // Shared scheduler export must exist on the non-platform module.
  const { createLayerScheduler: shared } = await import('@/lib/soundLayers');
  assert.equal(typeof shared, 'function');
});
