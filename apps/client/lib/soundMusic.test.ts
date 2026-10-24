import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  MUSIC_BED_BRIGHT,
  MUSIC_BED_CALM,
  MUSIC_DROPINS,
  MUSIC_FADE_MAX_MS,
  MUSIC_FADE_MIN_MS,
  MUSIC_FADE_MS,
  MUSIC_GESTURE_IDLE_MS,
  MUSIC_INTRO_LOOP,
  MUSIC_MAX_PLAYERS,
  MUSIC_TEXTURES,
  bedAssetForProgress,
  computeMusicProgress,
  createSoundMusicEngine,
  loopEndSecondsFromDurationMs,
  textureCountForProgress,
  texturesForProgress,
  type MusicEngine,
  type MusicPlayer,
} from '@/lib/soundMusic';
import { getSoundAssetDurationMs, type SoundAssetName } from '@/lib/soundAssets';

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

  return {
    now: () => now,
    timers,
    advance,
  };
}

type MockMusicPlayer = MusicPlayer & {
  calls: { play: number; pause: number; release: number };
};

function mockPlayer(): MockMusicPlayer {
  const calls = { play: 0, pause: 0, release: 0 };
  const player: MockMusicPlayer = {
    calls,
    volume: 0,
    playing: false,
    loop: true,
    play() {
      calls.play += 1;
      player.playing = true;
    },
    pause() {
      calls.pause += 1;
      player.playing = false;
    },
    replace() {},
    seekTo() {},
    release() {
      calls.release += 1;
    },
  };
  return player;
}

const MODULES: Record<string, number> = {};
let moduleSeq = 1;

function moduleFor(name: SoundAssetName): number {
  if (!MODULES[name]) MODULES[name] = moduleSeq++;
  return MODULES[name]!;
}

function createEngine(
  clock: ReturnType<typeof createFakeClock>,
  opts: {
    random?: () => number;
    canStartMusic?: () => boolean;
    areDropInsBlocked?: () => boolean;
    maxPlayers?: number;
    getDurationMs?: (name: SoundAssetName) => number;
    fadeMs?: number;
  } = {},
): { engine: MusicEngine; players: MockMusicPlayer[] } {
  const players: MockMusicPlayer[] = [];
  let rand = 0.1;
  const random = opts.random ?? (() => {
    rand = (rand + 0.17) % 1;
    return rand;
  });

  const engine = createSoundMusicEngine({
    createPlayer: () => {
      const p = mockPlayer();
      players.push(p);
      return p;
    },
    resolveModule: (name) => moduleFor(name),
    getDurationMs: opts.getDurationMs ?? ((name) => getSoundAssetDurationMs(name)),
    now: clock.now,
    random,
    setTimeout: clock.timers.setTimeout as typeof setTimeout,
    clearTimeout: clock.timers.clearTimeout as typeof clearTimeout,
    canStartMusic: opts.canStartMusic,
    areDropInsBlocked: opts.areDropInsBlocked,
    maxPlayers: opts.maxPlayers,
    fadeMs: opts.fadeMs ?? MUSIC_FADE_MS,
  });

  return { engine, players };
}

afterEach(() => {
  // nothing global
});

test('progress mapping is 0..1 from complexity + laterality', () => {
  assert.equal(computeMusicProgress(1, 1), 0);
  assert.equal(computeMusicProgress(5, 5), 1);
  assert.ok(Math.abs(computeMusicProgress(3, 3) - 0.5) < 1e-9);
  assert.ok(computeMusicProgress(5, 1) > computeMusicProgress(1, 5) - 0.01);
});

test('texture count grows with progress; RM caps at 1; air only at max', () => {
  assert.equal(textureCountForProgress(0, false), 0);
  assert.equal(textureCountForProgress(0.3, false), 1);
  assert.equal(textureCountForProgress(0.6, false), 2);
  assert.equal(textureCountForProgress(0.8, false), 3);
  assert.equal(textureCountForProgress(0.95, false), 4);
  assert.equal(textureCountForProgress(0.95, true), 1);
  assert.deepEqual(texturesForProgress(0.95, false), [...MUSIC_TEXTURES]);
  assert.ok(!texturesForProgress(0.8, false).includes('music-texture-air-d'));
});

test('bed choice: calm low, bright high / random entry', () => {
  assert.equal(bedAssetForProgress(0.2, false), MUSIC_BED_CALM);
  assert.equal(bedAssetForProgress(0.7, false), MUSIC_BED_BRIGHT);
  assert.equal(bedAssetForProgress(0.1, true), MUSIC_BED_BRIGHT);
});

test('loop end seconds come from durationMs (AAC padding), never hard-coded', () => {
  const introMs = getSoundAssetDurationMs(MUSIC_INTRO_LOOP);
  assert.equal(introMs, 6000);
  assert.equal(loopEndSecondsFromDurationMs(introMs), 6);
  assert.equal(getSoundAssetDurationMs(MUSIC_BED_CALM), 45000);
  assert.equal(getSoundAssetDurationMs('music-texture-shimmer-a'), 23000);
  assert.equal(getSoundAssetDurationMs('music-texture-subswell-b'), 29000);
  assert.equal(getSoundAssetDurationMs('music-texture-tonedrift-c'), 37000);
  assert.equal(getSoundAssetDurationMs('music-texture-air-d'), 41000);
  // Fade bounds stay within ticket 3–8 s.
  assert.ok(MUSIC_FADE_MS >= MUSIC_FADE_MIN_MS && MUSIC_FADE_MS <= MUSIC_FADE_MAX_MS);
});

test('intro_started then intro_ready: never exceeds max players; fades on transitions', () => {
  const clock = createFakeClock();
  const { engine } = createEngine(clock);

  engine.handleEvent({ name: 'intro_started' });
  assert.equal(engine.getPhase(), 'intro');
  assert.ok(engine.getActivePlayerCount() <= MUSIC_MAX_PLAYERS);
  assert.ok(engine.getFades().length >= 1);

  // Advance past first intro crossfade lead (durationMs - fade).
  const introDur = getSoundAssetDurationMs(MUSIC_INTRO_LOOP);
  clock.advance(introDur);
  assert.ok(engine.getActivePlayerCount() <= MUSIC_MAX_PLAYERS);

  engine.handleEvent({ name: 'intro_ready' });
  assert.equal(engine.getPhase(), 'bed');
  assert.ok(engine.getBedAsset() === MUSIC_BED_CALM || engine.getBedAsset() === MUSIC_BED_BRIGHT);
  assert.ok(engine.getActivePlayerCount() <= MUSIC_MAX_PLAYERS);
  assert.ok(engine.getFades().every((f) => f.durationMs >= 0));
  // Every transition recorded fades (no hard-cut-only path).
  assert.ok(engine.getFades().length >= 3);

  engine.reset();
});

test('never more than MUSIC_MAX_PLAYERS under bed + textures + drop-in pressure', () => {
  const clock = createFakeClock();
  const { engine } = createEngine(clock, {
    random: () => 0.99, // prefer bright / late drop-in picks
  });

  engine.setProgressInputs(5, 5);
  engine.handleEvent({ name: 'intro_started' });
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(MUSIC_FADE_MS + 100);

  // Force texture sync at max progress.
  engine.setProgressInputs(5, 5);
  clock.advance(MUSIC_FADE_MS + 100);

  // Crossfade beds/textures a few times.
  for (let i = 0; i < 5; i++) {
    clock.advance(getSoundAssetDurationMs(MUSIC_BED_CALM));
    assert.ok(
      engine.getActivePlayerCount() <= MUSIC_MAX_PLAYERS,
      `players ${engine.getActivePlayerCount()} at iter ${i}`,
    );
  }

  engine.reset();
});

test('drop-in skips during gesture idle window; never repeats consecutive', () => {
  const clock = createFakeClock();
  let pick = 0;
  const { engine } = createEngine(clock, {
    random: () => {
      const v = (pick * 0.17) % 1;
      pick += 1;
      return v;
    },
  });

  engine.handleEvent({ name: 'intro_started' });
  engine.handleEvent({ name: 'intro_ready' });
  // Drop-ins allowed; do not advance into the 20–60s schedule — use tryDropInNow.
  assert.equal(engine.getLastDropIn(), null);

  engine.noteGesture();
  engine.tryDropInNow();
  assert.equal(engine.getLastDropIn(), null, 'drop-in must not fire inside gesture idle');

  clock.advance(MUSIC_GESTURE_IDLE_MS + 1);
  engine.tryDropInNow();
  const first = engine.getLastDropIn();
  assert.notEqual(first, null);
  assert.ok((MUSIC_DROPINS as readonly string[]).includes(first!));

  engine.tryDropInNow();
  const second = engine.getLastDropIn();
  assert.notEqual(second, null);
  assert.notEqual(second, first);

  engine.reset();
});

test('drop-ins blocked while screen-reader / announcement flag set', () => {
  const clock = createFakeClock();
  let blocked = true;
  const { engine } = createEngine(clock, {
    random: () => 0,
    areDropInsBlocked: () => blocked,
  });

  engine.handleEvent({ name: 'intro_started' });
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(MUSIC_GESTURE_IDLE_MS + 20_000);
  assert.equal(engine.getLastDropIn(), null);

  blocked = false;
  engine.pauseDropIns();
  engine.resumeDropIns();
  clock.advance(MUSIC_GESTURE_IDLE_MS + 20_000);
  assert.ok(engine.getLastDropIn() != null);

  engine.reset();
});

test('Reduced Motion caps textures at 1', () => {
  const clock = createFakeClock();
  const { engine } = createEngine(clock);

  engine.setProgressInputs(5, 5);
  engine.setReducedMotion(true);
  engine.handleEvent({ name: 'intro_started' });
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(MUSIC_FADE_MS + 50);
  assert.ok(engine.getActiveTextures().length <= 1);

  engine.reset();
});

test('music off fades out; discovery duck records fades', () => {
  const clock = createFakeClock();
  const { engine } = createEngine(clock);

  engine.handleEvent({ name: 'intro_started' });
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(MUSIC_FADE_MS);
  const before = engine.getFades().length;

  engine.handleEvent({ name: 'reshuffle_landed', random: false });
  assert.ok(engine.getFades().length > before);

  engine.setEnabled(false);
  assert.equal(engine.getPhase(), 'stopped');
  clock.advance(MUSIC_FADE_MS + 20);

  engine.reset();
});

test('pause / resume / duck / restartBed hooks are fade-based', () => {
  const clock = createFakeClock();
  const { engine } = createEngine(clock);

  engine.handleEvent({ name: 'intro_ready' });
  engine.restartBed({ fadeIn: true });
  clock.advance(MUSIC_FADE_MS);
  const n = engine.getFades().length;

  engine.pause();
  engine.resume({ fadeIn: true });
  engine.duck(0.08);
  engine.restartBed({ fadeIn: true });
  assert.ok(engine.getFades().length > n);
  assert.ok(engine.getActivePlayerCount() <= MUSIC_MAX_PLAYERS);

  engine.reset();
});

test('B1: multi-loop crossfade arms next copy when B is created (no silence gap)', () => {
  const clock = createFakeClock();
  const loopMs = 10_000;
  const fadeMs = 4_000;
  const leadMs = loopMs - fadeMs;
  const createAt: number[] = [];
  const { engine, players } = createEngine(clock, {
    getDurationMs: () => loopMs,
    fadeMs,
    random: () => 0,
  });
  // Record create times (createEngine pushes into players; stamp after each growth).
  const stampCreates = () => {
    while (createAt.length < players.length) createAt.push(clock.now());
  };

  engine.setProgressInputs(1, 1);
  engine.handleEvent({ name: 'intro_ready' });
  stampCreates();
  // arrival + bed at t≈0
  const initialCreates = players.length;
  assert.ok(initialCreates >= 2);

  // B1: copies start at lead, 2*lead, 3*lead…
  // Old bug armed the next loop only after fade-in → 3rd copy at 2*lead+fade.
  clock.advance(leadMs);
  stampCreates();
  const after1 = players.length;
  assert.equal(after1, initialCreates + 1, '2nd bed copy starts at lead');

  clock.advance(leadMs);
  stampCreates();
  const after2 = players.length;
  assert.equal(after2, after1 + 1, '3rd bed copy starts at 2*lead (not 2*lead+fade)');

  clock.advance(leadMs);
  stampCreates();
  const after3 = players.length;
  assert.equal(after3, after2 + 1, '4th bed copy starts at 3*lead');

  // Confirm create timestamps align with lead cadence (not lead+fade).
  const bedCopyTimes = createAt.slice(initialCreates);
  assert.equal(bedCopyTimes[0], leadMs);
  assert.equal(bedCopyTimes[1], 2 * leadMs);
  assert.equal(bedCopyTimes[2], 3 * leadMs);

  engine.reset();
});

test('B2: quick off→on / stop→restartBed does not leave music silent', () => {
  const clock = createFakeClock();
  const { engine, players } = createEngine(clock, { random: () => 0 });

  engine.setProgressInputs(1, 1);
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(MUSIC_FADE_MS);
  assert.ok(engine.getActivePlayerCount() >= 1);

  // Off → on before stop's delayed release sweep fires.
  engine.setEnabled(false);
  assert.equal(engine.getPhase(), 'stopped');
  engine.setEnabled(true);
  clock.advance(MUSIC_FADE_MS + 20);

  assert.equal(engine.getPhase(), 'bed');
  assert.ok(engine.getActivePlayerCount() >= 1, 'bed alive after off→on race');
  assert.ok(engine.getBedAsset() != null);
  assert.ok(players.some((p) => p.playing));

  // stop → restartBed mid-fade.
  engine.stop();
  engine.restartBed({ fadeIn: true });
  clock.advance(MUSIC_FADE_MS + 20);
  assert.equal(engine.getPhase(), 'bed');
  assert.ok(engine.getActivePlayerCount() >= 1, 'bed alive after stop→restart race');

  // fadeIn: false snaps on a fresh bed start (M2).
  engine.stop();
  clock.advance(MUSIC_FADE_MS + 20);
  const before = engine.getFades().length;
  engine.setProgressInputs(5, 5);
  engine.restartBed({ fadeIn: false });
  const snap = engine.getFades().slice(before).find((f) => f.durationMs === 0 && f.to > 0);
  assert.ok(snap, 'fadeIn false uses a 0-ms snap fade');
  assert.equal(engine.getBedAsset(), MUSIC_BED_BRIGHT);
  assert.ok(engine.getActivePlayerCount() >= 1);

  engine.reset();
});

test('B3: pause clears timers; no creates while paused; resume re-arms', () => {
  const clock = createFakeClock();
  const loopMs = 10_000;
  const fadeMs = 4_000;
  const leadMs = loopMs - fadeMs;
  const { engine, players } = createEngine(clock, {
    getDurationMs: () => loopMs,
    fadeMs,
    random: () => 0,
  });

  engine.setProgressInputs(1, 1);
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(100);
  const createsBeforePause = players.length;

  engine.pause();
  clock.advance(500);
  assert.equal(
    players.length,
    createsBeforePause,
    'no new players while paused (crossfade timer must be cleared)',
  );

  engine.resume({ fadeIn: false });
  // Pause duration is added to loopAnchorAt — remaining lead is leadMs - 100
  // (played time only), not leadMs - 100 - 500.
  const remaining = leadMs - 100;
  clock.advance(remaining - 1);
  assert.equal(players.length, createsBeforePause, 'no create before remaining lead');
  clock.advance(1);
  assert.equal(
    players.length,
    createsBeforePause + 1,
    'resume re-arms crossfade — new copy at remaining lead',
  );

  engine.reset();
});

test('pause longer than lead does not crossfade immediately on resume', () => {
  const clock = createFakeClock();
  const loopMs = 10_000;
  const fadeMs = 4_000;
  const leadMs = loopMs - fadeMs;
  const { engine, players } = createEngine(clock, {
    getDurationMs: () => loopMs,
    fadeMs,
    random: () => 0,
  });

  engine.setProgressInputs(1, 1);
  engine.handleEvent({ name: 'intro_ready' });
  clock.advance(100);
  const n = players.length;

  engine.pause();
  clock.advance(leadMs + 2000);
  assert.equal(players.length, n);

  engine.resume({ fadeIn: false });
  // Flush any zero-delay schedule (old bug: pause longer than lead → leadMs=0).
  clock.advance(1);
  assert.equal(
    players.length,
    n,
    'long pause must not make next copy start immediately',
  );
  // Played time before pause was 100ms; remaining lead is leadMs - 100.
  // Already advanced 1ms after resume, so wait remaining - 2 more before the edge.
  const remaining = leadMs - 100;
  clock.advance(remaining - 2);
  assert.equal(players.length, n);
  clock.advance(1);
  assert.equal(players.length, n + 1, 'copy starts after played remaining lead');

  engine.reset();
});

test('pause frees stopping + one-shot slots (no leak across pause/resume)', () => {
  const clock = createFakeClock();
  const loopMs = 10_000;
  const fadeMs = 4_000;
  const leadMs = loopMs - fadeMs;
  const { engine, players } = createEngine(clock, {
    getDurationMs: () => loopMs,
    fadeMs,
    random: () => 0,
  });

  const releaseCount = () => players.reduce((sum, p) => sum + p.calls.release, 0);

  engine.setProgressInputs(1, 1);
  engine.handleEvent({ name: 'intro_ready' });
  // Mid-crossfade: A stopping (fade-out) + B live.
  clock.advance(leadMs + 100);
  const midCount = engine.getActivePlayerCount();
  assert.ok(midCount >= 2, 'crossfade overlap before pause');
  const releasesBefore = releaseCount();

  engine.pause();
  // Stopping copy finished immediately; arrival already freed as one-shot.
  assert.ok(engine.getActivePlayerCount() < midCount);
  assert.ok(releaseCount() > releasesBefore, 'stopping players released on pause');

  // Drop-in one-shot then pause before its end timer — must free, not leak.
  engine.resume({ fadeIn: false });
  clock.advance(MUSIC_GESTURE_IDLE_MS + 1);
  engine.tryDropInNow();
  assert.ok(engine.getLastDropIn() != null);
  const withDropIn = engine.getActivePlayerCount();
  const releasesMid = releaseCount();
  engine.pause();
  assert.ok(engine.getActivePlayerCount() < withDropIn, 'drop-in freed on pause');
  assert.ok(releaseCount() > releasesMid);

  engine.resume({ fadeIn: false });
  const creates0 = players.length;
  const releases0 = releaseCount();
  const liveAfter = engine.getActivePlayerCount();
  clock.advance(loopMs * 3);
  const createsDelta = players.length - creates0;
  const releasesDelta = releaseCount() - releases0;
  assert.ok(createsDelta >= 3, 'at least one new copy per loop');
  assert.ok(
    releasesDelta >= createsDelta - 1,
    'releases balance creates (no leaked slots)',
  );
  assert.ok(engine.getActivePlayerCount() <= MUSIC_MAX_PLAYERS);
  // Steady state: one live bed, or two during a crossfade overlap.
  assert.ok(
    engine.getActivePlayerCount() <= 2,
    `live count ${engine.getActivePlayerCount()} (was ${liveAfter} at resume)`,
  );

  engine.reset();
});
