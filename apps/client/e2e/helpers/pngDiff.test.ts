import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {
  CHANNEL_NOISE_FLOOR,
  DIFF_RATIO_THRESHOLD,
  PIXELMATCH_COLOR_THRESHOLD,
  diffPngs,
} from './pngDiff.ts';

/** Solid RGB PNG (opaque). */
function solid(width: number, height: number, r: number, g: number, b: number): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    png.data[o] = r;
    png.data[o + 1] = g;
    png.data[o + 2] = b;
    png.data[o + 3] = 255;
  }
  return png;
}

/**
 * Flat orange card vs same card with a low-contrast lighter block — models
 * pattern / watermark motifs that barely move RGB but are visually real.
 * Library-default pixelmatch threshold 0.1 reports 0% for this pair.
 */
function realChangePair(): { actual: PNG; baseline: PNG; blockPixels: number } {
  const w = 100;
  const h = 100;
  const baseline = solid(w, h, 230, 100, 40);
  const actual = solid(w, h, 230, 100, 40);
  let blockPixels = 0;
  for (let y = 10; y < 40; y++) {
    for (let x = 10; x < 40; x++) {
      const o = (y * w + x) * 4;
      actual.data[o] = 248; // +18 on R — above CHANNEL_NOISE_FLOOR, below 0.1 sensitivity
      blockPixels++;
    }
  }
  return { actual, baseline, blockPixels };
}

/** Same image with only encoder-noise deltas (≤ CHANNEL_NOISE_FLOOR per channel). */
function noiseOnlyPair(): { actual: PNG; baseline: PNG } {
  const w = 64;
  const h = 64;
  const baseline = solid(w, h, 200, 120, 50);
  const actual = solid(w, h, 200, 120, 50);
  const d = CHANNEL_NOISE_FLOOR; // max |Δ| = 3 — AD logo false-positive band
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    actual.data[o] = Math.min(255, baseline.data[o]! + d);
    actual.data[o + 1] = Math.min(255, baseline.data[o + 1]! + d);
    actual.data[o + 2] = Math.min(255, baseline.data[o + 2]! + d);
  }
  return { actual, baseline };
}

describe('pngDiff', () => {
  it('reports nonzero % for a real low-contrast change (regression: was 0% at 0.1)', () => {
    const { actual, baseline, blockPixels } = realChangePair();

    const legacyDiff = new PNG({ width: actual.width, height: actual.height });
    const legacyMismatched = pixelmatch(
      actual.data,
      baseline.data,
      legacyDiff.data,
      actual.width,
      actual.height,
      { threshold: 0.1 },
    );
    assert.equal(
      legacyMismatched,
      0,
      'fixture must stay invisible at pixelmatch 0.1 (documents the original bug)',
    );

    const result = diffPngs(actual, baseline);
    assert.equal(result.sizeMismatch, false);
    assert.ok(result.percent > 0, `expected nonzero % changed, got ${result.percent}`);
    assert.equal(result.mismatchedPixels, blockPixels);
    assert.ok(
      result.percent > DIFF_RATIO_THRESHOLD * 100,
      `expected over ratio threshold (${DIFF_RATIO_THRESHOLD}); got ${result.percent}%`,
    );
    assert.equal(result.overRatioThreshold, true);
    assert.equal(PIXELMATCH_COLOR_THRESHOLD, 0.01);
    assert.equal(CHANNEL_NOISE_FLOOR, 3);
  });

  it('reports 0% for noise-only images (|Δ| ≤ CHANNEL_NOISE_FLOOR)', () => {
    const { actual, baseline } = noiseOnlyPair();

    // Without the noise floor, pixelmatch at 0.01 would flag these.
    const rawDiff = new PNG({ width: actual.width, height: actual.height });
    const rawMismatched = pixelmatch(
      actual.data,
      baseline.data,
      rawDiff.data,
      actual.width,
      actual.height,
      { threshold: PIXELMATCH_COLOR_THRESHOLD },
    );
    assert.ok(
      rawMismatched > 0,
      'fixture must be visible to raw pixelmatch so the floor is doing work',
    );

    const result = diffPngs(actual, baseline);
    assert.equal(result.mismatchedPixels, 0);
    assert.equal(result.percent, 0);
    assert.equal(result.overRatioThreshold, false);
  });

  it('reports 0% for identical buffers', () => {
    const a = solid(16, 16, 10, 20, 30);
    const b = solid(16, 16, 10, 20, 30);
    const result = diffPngs(a, b);
    assert.equal(result.mismatchedPixels, 0);
    assert.equal(result.percent, 0);
    assert.equal(result.overRatioThreshold, false);
  });

  it('flags size mismatch without running pixelmatch', () => {
    const a = solid(10, 10, 0, 0, 0);
    const b = solid(12, 10, 0, 0, 0);
    const result = diffPngs(a, b);
    assert.equal(result.sizeMismatch, true);
    assert.equal(result.percent, 100);
    assert.equal(result.diff, undefined);
  });
});
