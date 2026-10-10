import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * pixelmatch color sensitivity (0–1). Library default is 0.1, which treats
 * low-contrast UI on flat fills (e.g. brand texture / pattern on orange) as
 * matching and reports ~0% changed despite large exact-pixel deltas.
 * 0.01 still surfaces real motif/watermark changes.
 */
export const PIXELMATCH_COLOR_THRESHOLD = 0.01;

/**
 * Per-channel encoder / AA noise floor (0–255). Pixels whose every RGBA
 * channel differs by at most this many levels are treated as identical before
 * pixelmatch runs — kills sub-perceptual sticky false positives (e.g. logo
 * lockup at 320 reporting 1.80% with max |Δ| = 3).
 */
export const CHANNEL_NOISE_FLOOR = 3;

/** Fraction of mismatched pixels above which a screen is "over-threshold". */
export const DIFF_RATIO_THRESHOLD = 0.01;

export type PngDiffResult = {
  width: number;
  height: number;
  mismatchedPixels: number;
  ratio: number;
  percent: number;
  overRatioThreshold: boolean;
  /** Filled RGBA diff buffer when sizes match; undefined on size mismatch. */
  diff: PNG | undefined;
  sizeMismatch: boolean;
};

/**
 * Copy of `actual` with pixels within {@link CHANNEL_NOISE_FLOOR} of `baseline`
 * forced equal (so pixelmatch does not count them).
 */
export function equalizeChannelNoise(actual: PNG, baseline: PNG): Buffer {
  const out = Buffer.from(actual.data);
  const floor = CHANNEL_NOISE_FLOOR;
  for (let i = 0; i < out.length; i += 4) {
    const dr = Math.abs(out[i]! - baseline.data[i]!);
    const dg = Math.abs(out[i + 1]! - baseline.data[i + 1]!);
    const db = Math.abs(out[i + 2]! - baseline.data[i + 2]!);
    const da = Math.abs(out[i + 3]! - baseline.data[i + 3]!);
    if (dr <= floor && dg <= floor && db <= floor && da <= floor) {
      out[i] = baseline.data[i]!;
      out[i + 1] = baseline.data[i + 1]!;
      out[i + 2] = baseline.data[i + 2]!;
      out[i + 3] = baseline.data[i + 3]!;
    }
  }
  return out;
}

/**
 * Compare two decoded PNGs. Callers supply buffers already read via PNG.sync.read.
 */
export function diffPngs(actual: PNG, baseline: PNG): PngDiffResult {
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return {
      width: actual.width,
      height: actual.height,
      mismatchedPixels: -1,
      ratio: 1,
      percent: 100,
      overRatioThreshold: true,
      diff: undefined,
      sizeMismatch: true,
    };
  }

  const filteredActual = equalizeChannelNoise(actual, baseline);
  const diff = new PNG({ width: actual.width, height: actual.height });
  const mismatchedPixels = pixelmatch(
    filteredActual,
    baseline.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: PIXELMATCH_COLOR_THRESHOLD },
  );
  const ratio = mismatchedPixels / (actual.width * actual.height);
  return {
    width: actual.width,
    height: actual.height,
    mismatchedPixels,
    ratio,
    percent: ratio * 100,
    overRatioThreshold: ratio > DIFF_RATIO_THRESHOLD,
    diff,
    sizeMismatch: false,
  };
}
