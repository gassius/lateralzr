import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {
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
function lowContrastPair(): { actual: PNG; baseline: PNG; blockPixels: number } {
  const w = 100;
  const h = 100;
  const baseline = solid(w, h, 230, 100, 40);
  const actual = solid(w, h, 230, 100, 40);
  let blockPixels = 0;
  for (let y = 10; y < 40; y++) {
    for (let x = 10; x < 40; x++) {
      const o = (y * w + x) * 4;
      actual.data[o] = 248; // +18 on R — below default 0.1 sensitivity
      blockPixels++;
    }
  }
  return { actual, baseline, blockPixels };
}

describe('pngDiff / PIXELMATCH_COLOR_THRESHOLD', () => {
  it('reports nonzero % for low-contrast motif change (regression: was 0% at 0.1)', () => {
    const { actual, baseline, blockPixels } = lowContrastPair();

    // Prove the old sensitivity hid the change entirely.
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
      'fixture must stay invisible at pixelmatch 0.1 (documents the bug)',
    );

    const result = diffPngs(actual, baseline);
    assert.equal(result.sizeMismatch, false);
    assert.ok(
      result.percent > 0,
      `expected nonzero % changed, got ${result.percent}`,
    );
    assert.equal(result.mismatchedPixels, blockPixels);
    assert.ok(
      result.percent > DIFF_RATIO_THRESHOLD * 100,
      `expected over ratio threshold (${DIFF_RATIO_THRESHOLD}); got ${result.percent}%`,
    );
    assert.equal(result.overRatioThreshold, true);
    assert.equal(PIXELMATCH_COLOR_THRESHOLD, 0.01);
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
