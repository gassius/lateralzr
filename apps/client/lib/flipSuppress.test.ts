import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FLIP_SUPPRESS_MS,
  isFlipSuppressed,
  suppressUntil,
} from '@/lib/flipSuppress';

describe('flip suppress window', () => {
  it('pins the AC window to 400 ms', () => {
    assert.equal(FLIP_SUPPRESS_MS, 400);
  });

  it('suppressUntil is now + window', () => {
    assert.equal(suppressUntil(1_000), 1_400);
    assert.equal(suppressUntil(1_000, 250), 1_250);
  });

  it('is suppressed inside the window, allowed at and after the boundary', () => {
    const now = 10_000;
    const until = suppressUntil(now);
    assert.equal(until, now + FLIP_SUPPRESS_MS);

    assert.equal(isFlipSuppressed(now, until), true);
    assert.equal(isFlipSuppressed(now + 399, until), true);
    assert.equal(isFlipSuppressed(now + FLIP_SUPPRESS_MS, until), false);
    assert.equal(isFlipSuppressed(now + FLIP_SUPPRESS_MS + 1, until), false);
  });

  it('fails open when until is in the past or equal to now', () => {
    assert.equal(isFlipSuppressed(500, 500), false);
    assert.equal(isFlipSuppressed(501, 500), false);
  });
});
