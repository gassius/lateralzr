import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOGO_DOT_COUNT,
  LOGO_ONE_CYCLE_MS,
  LOGO_PULSE_HALF_MS,
  LOGO_PULSE_MS,
  LOGO_STAGGER_MS,
  MIN_INTRO_LOGO_MS,
  remainingIntroMs,
} from './introLogo';

test('logo timing constants match one full staggered cycle', () => {
  assert.equal(LOGO_PULSE_MS, LOGO_PULSE_HALF_MS * 2);
  assert.equal(LOGO_ONE_CYCLE_MS, LOGO_STAGGER_MS * (LOGO_DOT_COUNT - 1) + LOGO_PULSE_MS);
  assert.equal(LOGO_ONE_CYCLE_MS, 1240);
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
