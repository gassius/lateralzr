/**
 * Pure PNG checks for PatternLayer raster E2E (B5).
 * Decoded off-DOM so node:test can cover the thresholds without Playwright.
 */
import { PNG } from 'pngjs';

/** Mirror of `patternBitmapCache.PATTERN_BITMAP_MAX_PIXEL_RATIO` — keep in sync. */
export const PATTERN_BITMAP_MAX_PIXEL_RATIO_CLIENT = 3;

/** Connector glow fill `#FFC98A` (theme PATTERN_PULSE_GLOW_FILL). */
export const PATTERN_GLOW_RGB = { r: 0xff, g: 0xc9, b: 0x8a } as const;

/** Max |Δ| per channel to count as glow-ish (AA / encode noise). */
export const PATTERN_GLOW_CHANNEL_TOLERANCE = 36;

/** Min opaque non-near-orange-fill pixels that must be present (not a blank PNG). */
export const PATTERN_MIN_OPAQUE_PIXELS = 64;

/** Min glow-ish pixels — restores old “connector groups > 0 / fill #FFC98A” signal. */
export const PATTERN_MIN_GLOW_PIXELS = 8;

export type PatternRasterAnalysis = {
  width: number;
  height: number;
  opaquePixels: number;
  glowPixels: number;
  sizeOk: boolean;
  nonBlank: boolean;
  hasGlow: boolean;
};

function channelNear(
  actual: number,
  expected: number,
  tol: number,
): boolean {
  return Math.abs(actual - expected) <= tol;
}

export function decodeDataImagePng(dataUri: string): PNG {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUri.trim());
  if (!match?.[1]) {
    throw new Error(`expected data:image/png;base64,…, got ${dataUri.slice(0, 48)}`);
  }
  return PNG.sync.read(Buffer.from(match[1], 'base64'));
}

/**
 * Score a captured pattern PNG: size (±tol vs layout×DPR), non-blank, glow pixels.
 */
export function analyzePatternRasterPng(
  png: PNG,
  options: {
    expectedWidth: number;
    expectedHeight: number;
    /** Pixel size tolerance (rounding / max-edge scale). */
    sizeTolerance?: number;
    glowRgb?: { r: number; g: number; b: number };
    glowTolerance?: number;
    minOpaque?: number;
    minGlow?: number;
  },
): PatternRasterAnalysis {
  const sizeTol = options.sizeTolerance ?? 2;
  const glow = options.glowRgb ?? PATTERN_GLOW_RGB;
  const glowTol = options.glowTolerance ?? PATTERN_GLOW_CHANNEL_TOLERANCE;
  const minOpaque = options.minOpaque ?? PATTERN_MIN_OPAQUE_PIXELS;
  const minGlow = options.minGlow ?? PATTERN_MIN_GLOW_PIXELS;

  let opaquePixels = 0;
  let glowPixels = 0;
  const { data, width, height } = png;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 200) continue;
    opaquePixels += 1;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (
      channelNear(r, glow.r, glowTol) &&
      channelNear(g, glow.g, glowTol) &&
      channelNear(b, glow.b, glowTol)
    ) {
      glowPixels += 1;
    }
  }

  const sizeOk =
    Math.abs(width - options.expectedWidth) <= sizeTol &&
    Math.abs(height - options.expectedHeight) <= sizeTol;

  return {
    width,
    height,
    opaquePixels,
    glowPixels,
    sizeOk,
    nonBlank: opaquePixels >= minOpaque,
    hasGlow: glowPixels >= minGlow,
  };
}
