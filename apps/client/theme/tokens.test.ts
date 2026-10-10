import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { blendHexOver, contrastRatio } from './contrast.ts';
import { logoNearBlack } from './logo.ts';
import { color, tokens } from './tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const section23 = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));

describe('v3.3 design tokens', () => {
  it('matches guide §23 tokens.json exactly', () => {
    assert.deepEqual(tokens, section23);
  });

  it('keeps logoNearBlack outside the UI color map', () => {
    assert.equal(logoNearBlack, '#231F20');
    assert.equal(section23.logoOnly.logoNearBlack, logoNearBlack);
    assert.equal(
      Object.prototype.hasOwnProperty.call(color, 'logoNearBlack'),
      false,
    );
    assert.notEqual(color.ink, logoNearBlack);
  });

  it('meets §6.1 contrast pairs to 2 decimal places', () => {
    const pairs: Array<[string, string, number]> = [
      [color.ink, color.paper, 14.53],
      [color.concept, color.front, 3.15],
      [color.ink, color.front, 6.85],
      [color.paper, color.shell, 12.82],
      [color.mutedOnPaper, color.paper, 5.49],
      [color.mutedOnShell, color.shell, 7.77],
      [color.rail, color.shell, 4.67],
      [color.front, color.shell, 6.04],
      [color.controlBorder, color.paper, 3.75],
      [color.controlBorder, color.selectedSoft, 3.38],
      [color.ink, color.selectedSoft, 13.09],
      [color.mutedOnPaper, color.selectedSoft, 4.95],
      [color.error, color.paper, 6.16],
    ];

    for (const [fg, bg, expected] of pairs) {
      const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
      assert.equal(ratio, expected, `${fg} on ${bg}`);
    }
  });

  it('exposes blend helper for legacy contrast checks', () => {
    const washed = blendHexOver(color.concept, 0.75, color.front);
    assert.match(washed, /^#[0-9a-f]{6}$/i);
  });
});
