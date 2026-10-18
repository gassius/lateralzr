import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOGO_SVG_WHITE_DOT_PATHS } from '../assets/images/lateralzrLogoLayers.ts';
import { WORDMARK_PATH_IDS } from '../assets/images/lateralzrMark.ts';
import {
  INTRO_LOGO_PULSE_FILL,
  INTRO_LOGO_PULSE_MAX_MS,
  INTRO_LOGO_PULSE_NODE_ID,
  INTRO_LOGO_PULSE_PEAK_OPACITY,
  introLogoPulseAllowed,
  LOGO_ONE_CYCLE_MS,
  LOGO_PULSE_HALF_MS,
  MIN_INTRO_LOGO_MS,
  recolouredIntroPulsePath,
  remainingIntroMs,
} from './introLogo';

test('logo timing is one §5.2 cycle', () => {
  assert.equal(LOGO_ONE_CYCLE_MS, INTRO_LOGO_PULSE_MAX_MS);
  assert.equal(LOGO_PULSE_HALF_MS * 2, INTRO_LOGO_PULSE_MAX_MS);
  assert.equal(INTRO_LOGO_PULSE_MAX_MS, 1200);
  assert.ok(MIN_INTRO_LOGO_MS >= LOGO_ONE_CYCLE_MS);
  assert.ok(MIN_INTRO_LOGO_MS >= 3000);
});

test('remainingIntroMs waits out the minimum when fetch is fast', () => {
  const started = 1_000_000;
  assert.equal(remainingIntroMs(started, started + 200, 3000), 2800);
  assert.equal(remainingIntroMs(started, started + 3000, 3000), 0);
  assert.equal(remainingIntroMs(started, started + 4500, 3000), 0);
});

test('remainingIntroMs never goes negative', () => {
  assert.equal(remainingIntroMs(100, 99, 3000), 3000);
});

test('optional intro node pulse is one terminal node in glow colour', () => {
  assert.equal(INTRO_LOGO_PULSE_MAX_MS, 1200);
  assert.equal(INTRO_LOGO_PULSE_FILL, '#FFC98A');
  assert.equal(INTRO_LOGO_PULSE_PEAK_OPACITY, 0.55);
  assert.equal(introLogoPulseAllowed(false), true);
  assert.equal(introLogoPulseAllowed(true), false);
  assert.equal(
    WORDMARK_PATH_IDS.includes(INTRO_LOGO_PULSE_NODE_ID as (typeof WORDMARK_PATH_IDS)[number]),
    false,
  );
  const fragment = LOGO_SVG_WHITE_DOT_PATHS.find((p) =>
    p.includes(`id="${INTRO_LOGO_PULSE_NODE_ID}"`),
  );
  assert.ok(fragment);
  const recoloured = recolouredIntroPulsePath(fragment!);
  assert.match(recoloured, /#FFC98A/);
  assert.doesNotMatch(recoloured, /#ffffff/i);
  for (const id of WORDMARK_PATH_IDS) {
    assert.doesNotMatch(recoloured, new RegExp(`id="${id}"`));
  }
});
