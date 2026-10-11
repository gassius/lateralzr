import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { motion } from '@/theme/tokens';
import type { MotionPreference } from '@/lib/motionStorage';
import {
  CONTROL_MS,
  REDUCED_MOTION_CROSSFADE_MS,
  SHEET_MS,
  initialPrefersReducedMotion,
  readWebPrefersReducedMotion,
  resolveInitialReducedMotion,
  resolveReducedMotion,
  sheetAppearDurationMs,
  sheetUsesSlide,
  shouldPulse,
} from '@/lib/reducedMotion';

describe('reduced-motion tokens', () => {
  it('pins cross-fade / sheet / control to §23 motion tokens', () => {
    assert.equal(REDUCED_MOTION_CROSSFADE_MS, motion.reducedMotionCrossfadeMs);
    assert.equal(REDUCED_MOTION_CROSSFADE_MS, 150);
    assert.equal(SHEET_MS, motion.sheetMs);
    assert.equal(SHEET_MS, 280);
    assert.equal(CONTROL_MS, motion.controlMs);
    assert.equal(CONTROL_MS, 150);
    assert.equal(motion.pulseUnderReducedMotion, false);
  });
});

describe('initial reduced-motion (native cold start)', () => {
  it('is optimistic ON when matchMedia is unavailable (native / unknown)', () => {
    assert.equal(resolveInitialReducedMotion(null), true);
  });

  it('follows the sync web matchMedia read', () => {
    assert.equal(resolveInitialReducedMotion(false), false);
    assert.equal(resolveInitialReducedMotion(true), true);
  });

  it('treats this node test env as unknown (no window matchMedia) → optimistic ON', () => {
    assert.equal(readWebPrefersReducedMotion(), null);
    assert.equal(initialPrefersReducedMotion(), true);
  });
});

describe('sheet / pulse gates for shared consumers', () => {
  it('sheets appear instantly without slide under RM', () => {
    assert.equal(sheetAppearDurationMs(true), 0);
    assert.equal(sheetUsesSlide(true), false);
  });

  it('sheets use token slide duration when motion is allowed', () => {
    assert.equal(sheetAppearDurationMs(false), SHEET_MS);
    assert.equal(sheetUsesSlide(false), true);
  });

  it('pulse is off under RM per pulseUnderReducedMotion token', () => {
    assert.equal(shouldPulse(true), false);
    assert.equal(shouldPulse(false), true);
  });
});

describe('resolveReducedMotion', () => {
  const prefs: Array<MotionPreference | null | undefined> = [
    undefined,
    null,
    'system',
    'reduced',
    'full',
  ];

  it('OS reduce-motion on ⇒ reduced regardless of web / appPref', () => {
    for (const web of [false, true, null] as const) {
      for (const appPref of prefs) {
        assert.equal(
          resolveReducedMotion({ os: true, web, appPref }),
          true,
          `os=true web=${String(web)} appPref=${String(appPref)}`,
        );
      }
    }
  });

  it('web reduce-motion on ⇒ reduced regardless of appPref (os off)', () => {
    for (const appPref of prefs) {
      assert.equal(
        resolveReducedMotion({ os: false, web: true, appPref }),
        true,
        `web=true appPref=${String(appPref)}`,
      );
    }
  });

  it('appPref Reduced ⇒ reduced when OS/web are off', () => {
    assert.equal(resolveReducedMotion({ os: false, web: false, appPref: 'reduced' }), true);
    assert.equal(resolveReducedMotion({ os: false, web: null, appPref: 'reduced' }), true);
  });

  it('System / Full / unset ⇒ full motion when OS/web are off', () => {
    for (const appPref of [undefined, null, 'system', 'full'] as const) {
      assert.equal(
        resolveReducedMotion({ os: false, web: false, appPref }),
        false,
        `web=false appPref=${String(appPref)}`,
      );
      assert.equal(
        resolveReducedMotion({ os: false, web: null, appPref }),
        false,
        `web=null appPref=${String(appPref)}`,
      );
    }
  });

  it('truth table covers OS×web×appPref combinations', () => {
    const cases: Array<{
      os: boolean;
      web: boolean | null;
      appPref: MotionPreference | undefined;
      expected: boolean;
    }> = [
      { os: false, web: false, appPref: 'system', expected: false },
      { os: false, web: false, appPref: 'full', expected: false },
      { os: false, web: false, appPref: 'reduced', expected: true },
      { os: false, web: false, appPref: undefined, expected: false },
      { os: true, web: false, appPref: 'full', expected: true },
      { os: true, web: false, appPref: 'system', expected: true },
      { os: false, web: true, appPref: 'full', expected: true },
      { os: false, web: true, appPref: 'system', expected: true },
      { os: true, web: true, appPref: 'full', expected: true },
      { os: false, web: null, appPref: 'system', expected: false },
      { os: false, web: null, appPref: 'reduced', expected: true },
      { os: true, web: null, appPref: 'full', expected: true },
    ];

    for (const row of cases) {
      assert.equal(
        resolveReducedMotion({ os: row.os, web: row.web, appPref: row.appPref }),
        row.expected,
        JSON.stringify(row),
      );
    }
  });
});
