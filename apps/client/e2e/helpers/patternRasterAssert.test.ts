import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PNG } from 'pngjs';
import {
  analyzePatternRasterPng,
  decodeDataImagePng,
  PATTERN_GLOW_RGB,
} from './patternRasterAssert.ts';

function pngDataUri(width: number, height: number, fill: { r: number; g: number; b: number; a?: number }): string {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = fill.r;
    png.data[i + 1] = fill.g;
    png.data[i + 2] = fill.b;
    png.data[i + 3] = fill.a ?? 255;
  }
  const buf = PNG.sync.write(png);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

describe('analyzePatternRasterPng (B5)', () => {
  it('rejects blank / transparent captures', () => {
    const uri = pngDataUri(10, 10, { r: 0, g: 0, b: 0, a: 0 });
    const png = decodeDataImagePng(uri);
    const result = analyzePatternRasterPng(png, {
      expectedWidth: 10,
      expectedHeight: 10,
      minOpaque: 64,
      minGlow: 8,
    });
    assert.equal(result.sizeOk, true);
    assert.equal(result.nonBlank, false);
    assert.equal(result.hasGlow, false);
  });

  it('accepts size + opaque + glow-ish pixels', () => {
    const png = new PNG({ width: 20, height: 30 });
    for (let i = 0; i < png.data.length; i += 4) {
      // Card fill
      png.data[i] = 0xf7;
      png.data[i + 1] = 0x8d;
      png.data[i + 2] = 0x1e;
      png.data[i + 3] = 255;
    }
    // Paint a glow blob
    for (let y = 5; y < 10; y += 1) {
      for (let x = 5; x < 12; x += 1) {
        const i = (y * 20 + x) * 4;
        png.data[i] = PATTERN_GLOW_RGB.r;
        png.data[i + 1] = PATTERN_GLOW_RGB.g;
        png.data[i + 2] = PATTERN_GLOW_RGB.b;
        png.data[i + 3] = 255;
      }
    }
    const result = analyzePatternRasterPng(png, {
      expectedWidth: 20,
      expectedHeight: 30,
      minOpaque: 64,
      minGlow: 8,
    });
    assert.equal(result.sizeOk, true);
    assert.equal(result.nonBlank, true);
    assert.equal(result.hasGlow, true);
    assert.ok(result.glowPixels >= 8);
  });

  it('decodeDataImagePng rejects non-png data URIs', () => {
    assert.throws(() => decodeDataImagePng('data:image/jpeg;base64,xxx'), /expected data:image\/png/);
  });
});
