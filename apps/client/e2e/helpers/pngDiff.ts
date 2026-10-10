import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * pixelmatch color sensitivity (0–1). Library default is 0.1, which treats
 * low-contrast UI on flat fills (e.g. brand texture / pattern on orange) as
 * matching and reports ~0% changed despite large exact-pixel deltas.
 * 0.01 still ignores tiny AA noise but surfaces real motif/watermark changes.
 */
export const PIXELMATCH_COLOR_THRESHOLD = 0.01;

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

  const diff = new PNG({ width: actual.width, height: actual.height });
  const mismatchedPixels = pixelmatch(
    actual.data,
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
