import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blendHexOver, contrastRatio, hexToRgba } from './contrast.ts';
import { logoNearBlack } from './logo.ts';
import { GUIDE_SECTION_23 } from './section23.ts';
import { color, tallScreenMinHeight, tokens } from './tokens.ts';

describe('v3.3 design tokens', () => {
  it('matches guide §23 exactly', () => {
    // Independent pin copied from v3.3 §23 values — not loaded from tokens.json.
    assert.deepEqual(tokens, GUIDE_SECTION_23);
  });

  it('pins tallScreenMinHeight for cardToControlGapTall selection', () => {
    assert.equal(tallScreenMinHeight, 800);
  });

  it('keeps logoNearBlack outside the UI color map', () => {
    assert.equal(logoNearBlack, '#231F20');
    assert.equal(GUIDE_SECTION_23.logoOnly.logoNearBlack, logoNearBlack);
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

  it('exposes blend and rgba helpers derived from color tokens', () => {
    const washed = blendHexOver(color.concept, 0.75, color.front);
    assert.match(washed, /^#[0-9a-f]{6}$/i);
    assert.equal(hexToRgba(color.concept, 0.35), 'rgba(19,91,119,0.35)');
    assert.equal(hexToRgba(color.concept, 0.1), 'rgba(19,91,119,0.1)');
    assert.equal(hexToRgba(color.paper, 0.08), 'rgba(245,241,232,0.08)');
    assert.equal(hexToRgba(color.paper, 0.42), 'rgba(245,241,232,0.42)');
  });
});
