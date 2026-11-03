import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coachHintSlotHeight } from './coachHintPresentation.ts';
import { layout } from '../theme/tokens.ts';
import {
  cardStackAvailableHeight,
  COMPLEXITY_CONTROL_HEIGHT,
  CONTROL_MESSAGING_BAND_HEIGHT,
  LATERALITY_BAR_MIN_ROW_WIDTH,
  LATERALITY_CONTROL_HEIGHT,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  LATERALITY_STEP_SIZE,
  lateralityChromeReserve,
  messagingMinGapHeight,
  MIN_CARD_AREA_HEIGHT,
  resolveEqualCardGaps,
  STATUS_BAND_HEIGHT,
  STATUS_BAND_LINE_HEIGHT,
  STATUS_SLOT_MIN_WIDTH,
} from './lateralityChrome.ts';
import { WEB_PHONE_MIN_WIDTH } from './webPhoneFrame.ts';
import {
  cardVerticalBudget,
  resolveCardAspectLayout,
  resolveNativeCardLayout,
} from './cardLayout.ts';
import { practiceHeaderToComplexityOffset } from './practiceLayout.ts';

/** Phone-frame investigation target from Critiquito Lz-11. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

describe('laterality chrome grouping (v3.5)', () => {
  it('uses label row + 48px rail (messaging lives in the lower card gap)', () => {
    assert.equal(STATUS_BAND_LINE_HEIGHT, 18);
    assert.equal(STATUS_BAND_HEIGHT, 36);
    assert.equal(coachHintSlotHeight(), 56);
    // Tip chip is taller than status — band = max(36, 56) = 56 (never sum).
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, 56);
    assert.equal(LATERALITY_LABEL_ROW_HEIGHT, 20);
    assert.equal(LATERALITY_RAIL_HEIGHT, 48);
    // 20 + 48 — no messaging band inside the control (Lz-67).
    assert.equal(LATERALITY_CONTROL_HEIGHT, 68);
    assert.equal(COMPLEXITY_CONTROL_HEIGHT, LATERALITY_CONTROL_HEIGHT);
    assert.equal(LATERALITY_STEP_SIZE, 48);
    assert.ok(LATERALITY_STEP_SIZE >= 44);
    assert.equal(lateralityChromeReserve(), 68);
    assert.equal(layout.cardGapAtReference, 45);
    assert.equal(layout.cardGaps, 'equal');
    assert.equal(layout.messagingLine, 'lower-card-gap');
  });

  it('splits leftover so visual gaps match (rail centreline ↔ Laterality label)', () => {
    const equal = resolveEqualCardGaps(90);
    // 90 − 24 rail slack → 33 / 57; visual = 33+24 / 57 = 57 / 57.
    assert.equal(equal.above, 33);
    assert.equal(equal.below, 57);
    assert.equal(equal.above + LATERALITY_RAIL_HEIGHT / 2, equal.below);
    assert.equal(messagingMinGapHeight(), 18 + 16);
    const tight = resolveEqualCardGaps(50);
    assert.equal(tight.above, 13);
    assert.equal(tight.below, 37);
  });

  it('reserves the control under the card; equal gaps are separate', () => {
    const usable = PHONE_HEIGHT;
    const available = cardStackAvailableHeight(usable);
    assert.equal(available, usable - lateralityChromeReserve());

    const card = resolveCardAspectLayout({
      columnWidth: PHONE_WIDTH,
      availableHeight: available,
      surplusMode: 'equal',
    });

    assert.ok(card.aspect >= 1.3);
    assert.ok(card.aspect <= 1.5);
    assert.ok(Math.abs(card.topSurplus + 24 - card.bottomSurplus) < 1e-6);
  });

  it('floors a short viewport at the minimum card height', () => {
    assert.equal(cardStackAvailableHeight(200), MIN_CARD_AREA_HEIGHT);
  });

  it('reserves a measured taller control when the label wraps', () => {
    const wrapped = LATERALITY_CONTROL_HEIGHT + 40;
    assert.equal(lateralityChromeReserve(wrapped), wrapped);
    assert.equal(
      cardStackAvailableHeight(844, wrapped),
      844 - lateralityChromeReserve(wrapped),
    );
  });

  it('pins the minimum row width to WEB_PHONE_MIN_WIDTH', () => {
    assert.equal(WEB_PHONE_MIN_WIDTH, 320);
    assert.equal(LATERALITY_BAR_MIN_ROW_WIDTH, WEB_PHONE_MIN_WIDTH);
  });

  it('pins a status-slot minimum that word-wraps meta at 200% text', () => {
    assert.equal(STATUS_SLOT_MIN_WIDTH, 120);
    assert.ok(STATUS_SLOT_MIN_WIDTH * 2 + 8 <= LATERALITY_BAR_MIN_ROW_WIDTH);
  });

  it('keeps tip/status content height shared so the card frame never jumps', () => {
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, coachHintSlotHeight());
    assert.ok(STATUS_BAND_HEIGHT <= CONTROL_MESSAGING_BAND_HEIGHT);
  });

  it('keeps a fixed lower-gap budget on 390×844 and 320×568 (overlay holds the 56 pt slot)', () => {
    assert.equal(CONTROL_MESSAGING_BAND_HEIGHT, 56);
    for (const [width, height, insetTop, insetBottom] of [
      [390, 844, 47, 34],
      [320, 568, 20, 20],
    ] as const) {
      const result = resolveNativeCardLayout({
        columnWidth: width,
        screenHeight: height,
        insetTop,
        insetBottom,
        headerToComplexityOffset: practiceHeaderToComplexityOffset(),
        complexityBarHeight: COMPLEXITY_CONTROL_HEIGHT,
        lateralityLabelAndRailHeight: LATERALITY_CONTROL_HEIGHT,
      });
      // Lower gap is a fixed layout height; messaging overlays at 56 without growing it.
      assert.ok(result.bottomSurplus >= 0);
      assert.ok(result.topSurplus >= 0);
      const budget = cardVerticalBudget({
        screenHeight: height,
        insetTop,
        insetBottom,
        headerToComplexityOffset: practiceHeaderToComplexityOffset(),
        complexityBarHeight: COMPLEXITY_CONTROL_HEIGHT,
        lateralityLabelAndRailHeight: LATERALITY_CONTROL_HEIGHT,
      });
      // When preferred fits, surplus + card == budget; short phones may min-aspect overflow.
      if (result.aspect === 1.4) {
        assert.equal(
          result.topSurplus + result.height + result.bottomSurplus,
          budget,
        );
      }
    }
  });
});
