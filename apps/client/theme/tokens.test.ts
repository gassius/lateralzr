import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blendHexOver, contrastRatio, hexToRgba } from './contrast.ts';
import { logoNearBlack } from './logo.ts';
import { GUIDE_SECTION_23 } from './section23.ts';
import { color, tallScreenMinHeight, tokens } from './tokens.ts';

describe('v3.4 design tokens', () => {
  it('matches the Lz-55/Lz-56/Lz-57/Lz-59/Lz-60 §23 pin (sheets, cardAspect, media, webPreview, build, motion.swipe/deck/flip, reshuffle + laterality filter)', () => {
    // Independent pin — not loaded from tokens.json.
    assert.deepEqual(tokens, GUIDE_SECTION_23);
    assert.equal(tokens.version, '3.4');
    assert.equal(tokens.layout.sheetRadius, 22);
    assert.equal(tokens.layout.sheetInset, 12);
    assert.equal(tokens.layout.sheetBottomGap, 12);
    assert.equal(tokens.layout.sheetGroupRadius, 16);
    assert.equal(tokens.layout.sheetRowHeight, 56);
    assert.equal(tokens.layout.sheetHandleStrip, 48);
    assert.equal(tokens.layout.sheetPattern, 'none');
    assert.equal(tokens.color.sheetGroup, '#FFFFFF8C');
    assert.equal(tokens.color.scrim, '#00000073');
    assert.equal(tokens.type.family, 'Inter');
    assert.equal(tokens.type.sheetTitle, 22);
    assert.equal(tokens.font.family.regular, 'Inter_400Regular');
    assert.equal(tokens.font.family.medium, 'Inter_500Medium');
    assert.equal(tokens.font.family.semiBold, 'Inter_600SemiBold');
    assert.equal(tokens.font.family.bold, 'Inter_700Bold');
    assert.equal(
      Object.prototype.hasOwnProperty.call(tokens.layout, 'sheetTopRadius'),
      false,
    );
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
    assert.equal(tokens.motion.flip.ms, 360);
    assert.equal(tokens.motion.flip.bidirectional, true);
    assert.equal(tokens.motion.flip.ms, tokens.motion.flipMs);
    assert.equal(tokens.motion.swipe.commitRatio, 0.3);
    assert.equal(tokens.motion.swipe.exitMs, 260);
    assert.equal(tokens.motion.swipe.returnSpring.damping, 26);
    assert.equal(tokens.motion.swipe.returnSpring.stiffness, 260);
    assert.equal(tokens.motion.swipe.tiltZDegAtHalf, 8);
    assert.equal(tokens.motion.swipe.startOfHistoryResistance, 0.35);
    assert.equal(tokens.motion.swipe.backFaceScrollHandoffPx, 24);
    assert.equal(tokens.motion.deck.underlays, 1);
    assert.equal(tokens.motion.deck.nextVisibleAtRest, false);
    assert.equal(tokens.motion.deck.nextScale, 0.95);
    assert.equal(tokens.motion.deck.nextOffsetY, 10);
    assert.equal(tokens.motion.deck.nextTint, 0.22);
    assert.equal(tokens.motion.reshuffle.gatherMs, 260);
    assert.equal(tokens.motion.reshuffle.minCueMs, 900);
    assert.equal(tokens.motion.reshuffle.timeoutMs, 10000);
    assert.equal(tokens.motion.reshuffle.cardInputDuringShuffle, false);
    assert.equal(tokens.motion.reshuffle.reducedMotion.silhouettes, 1);
    assert.equal(tokens.laterality.filterByGrade, true);
    assert.equal(tokens.laterality.onChange, 'reshuffle-whole-deck');
    assert.equal(tokens.laterality.historyKeepsVisited, true);
    assert.equal(tokens.laterality.discardFutureOnChange, true);
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
