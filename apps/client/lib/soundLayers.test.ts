import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gainFromDb } from '@/lib/soundMap';
import {
  BED_HIGH_COMPLEXITY_GAIN_DB,
  createLayerScheduler,
  equalPowerCurve,
  equalPowerWeights,
  HIGH_COMPLEXITY_TEXTURE_CAP,
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

test('layerTargets: Laterality swaps arp→arp-bright at 4–5 and sets colour', () => {
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
  assert.equal(layerTargets(5, 1).lowpassHz, 2500);
  assert.equal(layerTargets(5, 5).lowpassHz, 16000);
  assert.equal(layerTargets(5, 1).width, 0.6);
  assert.equal(layerTargets(5, 5).width, 1.15);
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
