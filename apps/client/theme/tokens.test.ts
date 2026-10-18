import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blendHexOver, contrastRatio, hexToRgba } from './contrast.ts';
import { logoNearBlack } from './logo.ts';
import { GUIDE_SECTION_23 } from './section23.ts';
import { color, tallScreenMinHeight, tokens } from './tokens.ts';

describe('v3.4 design tokens', () => {
  it('matches the Lz-55/Lz-60 §23 pin (cardAspect, media, webPreview, build)', () => {
    // Independent pin — not loaded from tokens.json.
    assert.deepEqual(tokens, GUIDE_SECTION_23);
    assert.equal(tokens.version, '3.4');
    assert.equal(tokens.cardAspect.preferred, 1.4);
    assert.equal(tokens.cardAspect.min, 1.3);
    assert.equal(tokens.cardAspect.max, 1.5);
    assert.equal(tokens.cardAspect.minCardWidth, 288);
    assert.equal(tokens.cardAspect.surplusGoes, 'above-card');
    assert.equal(tokens.cardAspect.neverSquash, true);
    assert.deepEqual(tokens.media.fitBy, ['purpose', 'measured']);
    assert.equal(tokens.media.purposes.photo, 'cover');
    assert.equal(tokens.media.purposes.diagram, 'contain');
    assert.equal(tokens.media.maxRequestWidth, 1600);
    assert.equal(tokens.media.decodeTimeoutMs, 8000);
    assert.equal(tokens.media.fadeOnlyOnCover, true);
    assert.equal(tokens.media.darkBusyFadeRaise, 0.15);
    assert.deepEqual(tokens.media.requiredFields, [
      'purpose',
      'alt',
      'creator',
      'sourcePageUrl',
      'licenceName',
      'licenceUrl',
      'changeNotice',
      'focalX',
      'focalY',
      'tone',
    ]);
    assert.equal(tokens.build.showReferenceLinks.default, true);
    assert.equal(tokens.build.showMediaCredits.env, 'EXPO_PUBLIC_SHOW_MEDIA_CREDITS');
    assert.equal(tokens.build.userSetting, false);
    assert.equal(tokens.webPreview.outside, '#0E1012');
    assert.equal(tokens.webPreview.frameEdge, '#FFFFFF1A');
    assert.equal(tokens.webPreview.simulatedSafeAreaTop, 47);
    assert.equal(tokens.webPreview.simulatedSafeAreaBottom, 34);
  });

  it('pins subdued card shadow tokens for ConceptCard / swirl', () => {
    assert.equal(tokens.shadow.card.color, '#000000');
    assert.equal(tokens.shadow.card.opacity, 0.18);
    assert.equal(tokens.shadow.card.radius, 12);
    assert.equal(tokens.shadow.card.elevation, 4);
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
