import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { motion } from '@/theme/tokens';
import {
  CONTROL_MS,
  REDUCED_MOTION_CROSSFADE_MS,
  SHEET_MS,
  initialPrefersReducedMotion,
  readWebPrefersReducedMotion,
  resolveInitialReducedMotion,
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
